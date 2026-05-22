import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

// ── E2E test-database bootstrap ───────────────────────────────────────────────
// Creates a dedicated `centsible_test` schema inside the existing MariaDB
// instance, runs Drizzle migrations against it, and exposes a FK-safe
// `truncateAll()` so each test run starts from a known-empty state.
//
// The "dev" schema (e.g. `centsible`) is never touched.

const TEST_DB_NAME = process.env.E2E_DB_NAME?.trim() || "centsible_test";

function dbHost() {
  return process.env.DB_HOST?.trim() || "localhost";
}
function dbPort() {
  return Number(process.env.DB_PORT) || 3306;
}
function dbUser() {
  return process.env.DB_USER?.trim() || "centsible";
}
function dbPassword() {
  return process.env.DB_PASSWORD?.trim() || "centsible_dev";
}
function rootPassword() {
  return process.env.MARIADB_ROOT_PASSWORD?.trim() || "";
}

export function testDbName(): string {
  return TEST_DB_NAME;
}

// Tables in FK-safe truncate order. Children before parents.
// `exchange_rates` is intentionally excluded — global-setup seeds it once and
// per-spec truncation must not blow that away.
const TRUNCATE_ORDER = [
  "savings_contributions",
  "transactions",
  "budgets",
  "subscriptions",
  "recurring_income",
  "savings_goals",
  "categories",
  "refresh_tokens",
  "rate_limit_counters",
  "users",
] as const;

async function rootConnection(database?: string) {
  const root = rootPassword();
  if (!root) {
    throw new Error(
      "MARIADB_ROOT_PASSWORD must be set in the environment to create the E2E test schema."
    );
  }
  return mysql.createConnection({
    host: dbHost(),
    port: dbPort(),
    user: "root",
    password: root,
    database,
    multipleStatements: true,
    timezone: "+00:00",
  });
}

export async function ensureTestDatabase(): Promise<void> {
  const conn = await rootConnection();
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    // Grant the app user access to the test schema. Idempotent.
    await conn.query(
      `GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO ?@'%'`,
      [dbUser()]
    );
    await conn.query("FLUSH PRIVILEGES");
  } finally {
    await conn.end();
  }
}

function migrationsFolder(): string {
  // packages/api/src/db/test-setup.ts → packages/api/drizzle
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "drizzle");
}

export async function migrateTestDatabase(): Promise<void> {
  const pool = mysql.createPool({
    host: dbHost(),
    port: dbPort(),
    user: dbUser(),
    password: dbPassword(),
    database: TEST_DB_NAME,
    connectionLimit: 2,
    timezone: "+00:00",
    multipleStatements: true,
  });
  try {
    const db = drizzle(pool, { schema, mode: "default" });
    await migrate(db, { migrationsFolder: migrationsFolder() });
  } finally {
    await pool.end();
  }
}

export async function truncateAll(): Promise<void> {
  const pool = mysql.createPool({
    host: dbHost(),
    port: dbPort(),
    user: dbUser(),
    password: dbPassword(),
    database: TEST_DB_NAME,
    connectionLimit: 2,
    timezone: "+00:00",
  });
  try {
    const db = drizzle(pool, { schema, mode: "default" });
    await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 0"));
    for (const table of TRUNCATE_ORDER) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
    }
    await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 1"));
  } finally {
    await pool.end();
  }
}

export async function seedExchangeRates(): Promise<void> {
  // Pre-seed today's GBP/USD/EUR/ZAR rates so the cached-rate fallback in
  // exchange-rates.ts returns deterministic values when the upstream URL is
  // pointed at an unreachable host during E2E.
  const today = new Date().toISOString().slice(0, 10);
  const rates: Array<[string, string, string]> = [
    ["GBP", "GBP", "1.00000000"],
    ["GBP", "USD", "1.28000000"],
    ["GBP", "EUR", "1.16000000"],
    ["GBP", "ZAR", "23.40000000"],
    ["USD", "USD", "1.00000000"],
    ["USD", "GBP", "0.78000000"],
    ["USD", "EUR", "0.91000000"],
    ["USD", "ZAR", "18.30000000"],
    ["EUR", "EUR", "1.00000000"],
    ["EUR", "GBP", "0.86000000"],
    ["EUR", "USD", "1.10000000"],
    ["EUR", "ZAR", "20.20000000"],
  ];

  const pool = mysql.createPool({
    host: dbHost(),
    port: dbPort(),
    user: dbUser(),
    password: dbPassword(),
    database: TEST_DB_NAME,
    connectionLimit: 2,
    timezone: "+00:00",
  });
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query("TRUNCATE TABLE `exchange_rates`");
      for (const [base, target, rate] of rates) {
        await conn.query(
          "INSERT INTO `exchange_rates` (base_currency, target_currency, rate, date) VALUES (?, ?, ?, ?)",
          [base, target, rate, today]
        );
      }
    } finally {
      conn.release();
    }
  } finally {
    await pool.end();
  }
}

export async function dropTestDatabase(): Promise<void> {
  const conn = await rootConnection();
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  } finally {
    await conn.end();
  }
}

// Allow invocation as a script: `bun run packages/api/src/db/test-setup.ts`
if (import.meta.main) {
  const cmd = process.argv[2] || "bootstrap";
  const run = async () => {
    if (cmd === "bootstrap") {
      await ensureTestDatabase();
      await migrateTestDatabase();
      await truncateAll();
      await seedExchangeRates();
      console.log(`E2E DB '${TEST_DB_NAME}' ready.`);
    } else if (cmd === "truncate") {
      await truncateAll();
      console.log(`E2E DB '${TEST_DB_NAME}' truncated.`);
    } else if (cmd === "drop") {
      await dropTestDatabase();
      console.log(`E2E DB '${TEST_DB_NAME}' dropped.`);
    } else {
      console.error(`Unknown command: ${cmd}`);
      process.exit(2);
    }
  };
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
