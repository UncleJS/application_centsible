import { dropTestDatabase, testDbName } from "./db";

// Set E2E_DROP_DB_ON_TEARDOWN=1 to drop the schema between runs. Default is to
// keep it so failed runs can be inspected with drizzle-studio or a mysql shell.
export default async function globalTeardown() {
  if (process.env.E2E_DROP_DB_ON_TEARDOWN === "1") {
    const name = testDbName();
    console.log(`[e2e] Dropping test database '${name}'…`);
    await dropTestDatabase();
  }
}
