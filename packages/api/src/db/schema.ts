import {
  mysqlTable,
  int,
  varchar,
  text,
  decimal,
  date,
  datetime,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// ── Timestamp helpers ──
// All datetime columns end in `_UTC` per the project naming standard.
// TypeScript property names stay camelCase for ergonomic queries.

const timestamps = {
  createdAt: datetime("created_at_UTC", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at_UTC", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date()),
};

const archivable = {
  ...timestamps,
  archivedAt: datetime("archived_at_UTC", { mode: "date" }),
};

// ── Users ──

export const users = mysqlTable(
  "users",
  {
    id: int("id").primaryKey().autoincrement(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("GBP"),
    ...archivable,
    // Generated column: equal to `email` when active, NULL when archived.
    // Indexed below so archived users free up their email for re-registration.
    activeEmail: varchar("active_email", { length: 255 }).generatedAlwaysAs(
      sql`(CASE WHEN \`archived_at_UTC\` IS NULL THEN \`email\` ELSE NULL END)`,
      { mode: "virtual" }
    ),
  },
  (table) => [
    uniqueIndex("users_active_email_unique").on(table.activeEmail),
  ]
);

// ── Refresh Tokens ──

export const refreshTokens = mysqlTable(
  "refresh_tokens",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenId: varchar("token_id", { length: 64 }).notNull(),
    familyId: varchar("family_id", { length: 64 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: datetime("expires_at_UTC", { mode: "date" }).notNull(),
    createdAt: datetime("created_at_UTC", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    revokedAt: datetime("revoked_at_UTC", { mode: "date" }),
    revokedReason: varchar("revoked_reason", { length: 32 }),
  },
  (table) => [
    index("refresh_tokens_user_idx").on(table.userId),
    index("refresh_tokens_hash_idx").on(table.tokenHash),
    uniqueIndex("refresh_tokens_token_id_unique").on(table.tokenId),
    index("refresh_tokens_family_idx").on(table.userId, table.familyId),
  ]
);

// ── Categories ──

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    icon: varchar("icon", { length: 10 }),
    color: varchar("color", { length: 7 }), // #RRGGBB
    type: varchar("type", { length: 10 }).notNull(), // 'income' | 'expense'
    ...archivable,
  },
  (table) => [
    index("categories_user_idx").on(table.userId),
    index("categories_type_idx").on(table.userId, table.type),
  ]
);

// ── Transactions ──

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: int("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 10 }).notNull(), // 'income' | 'expense'
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    convertedAmount: decimal("converted_amount", { precision: 12, scale: 2 }),
    description: varchar("description", { length: 255 }).notNull().default(""),
    date: date("date", { mode: "string" }).notNull(), // YYYY-MM-DD
    subscriptionId: int("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    isRecurring: boolean("is_recurring").notNull().default(false),
    ...archivable,
  },
  (table) => [
    index("transactions_user_idx").on(table.userId),
    index("transactions_date_idx").on(table.userId, table.date),
    index("transactions_category_idx").on(table.userId, table.categoryId),
    index("transactions_type_date_idx").on(table.userId, table.type, table.date),
  ]
);

// ── Budgets ──

export const budgets = mysqlTable(
  "budgets",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: int("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    year: int("year").notNull(),
    month: int("month").notNull(), // 1-12
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    ...archivable,
    // Generated column: composite natural key for active rows only, NULL when
    // archived. Indexed below so archiving a budget frees up the period for a
    // new one. ON DUPLICATE KEY UPDATE in the upsert still fires against this.
    activePeriodKey: varchar("active_period_key", { length: 64 }).generatedAlwaysAs(
      sql`(CASE WHEN \`archived_at_UTC\` IS NULL THEN CONCAT_WS(':', \`user_id\`, \`category_id\`, \`year\`, \`month\`) ELSE NULL END)`,
      { mode: "virtual" }
    ),
  },
  (table) => [
    index("budgets_user_period_idx").on(table.userId, table.year, table.month),
    uniqueIndex("budgets_active_period_unique").on(table.activePeriodKey),
  ]
);

// ── Savings Goals ──

export const savingsGoals = mysqlTable(
  "savings_goals",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: decimal("current_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    currency: varchar("currency", { length: 3 }).notNull(),
    targetDate: date("target_date", { mode: "string" }).notNull(),
    icon: varchar("icon", { length: 10 }),
    ...archivable,
  },
  (table) => [
    index("savings_goals_user_idx").on(table.userId),
  ]
);

// ── Savings Contributions ──

export const savingsContributions = mysqlTable(
  "savings_contributions",
  {
    id: int("id").primaryKey().autoincrement(),
    savingsGoalId: int("savings_goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    note: varchar("note", { length: 255 }),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: datetime("created_at_UTC", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    archivedAt: datetime("archived_at_UTC", { mode: "date" }),
  },
  (table) => [
    index("savings_contributions_goal_idx").on(table.savingsGoalId),
  ]
);

// ── Subscriptions ──

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: int("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
    nextRenewalDate: date("next_renewal_date", { mode: "string" }).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    url: varchar("url", { length: 500 }),
    autoRenew: boolean("auto_renew").notNull().default(true),
    ...archivable,
  },
  (table) => [
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_renewal_idx").on(table.userId, table.nextRenewalDate),
  ]
);

// ── Recurring Income ──

export const recurringIncome = mysqlTable(
  "recurring_income",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: int("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
    autoRenew: boolean("auto_renew").notNull().default(true),
    ...archivable,
  },
  (table) => [
    index("recurring_income_user_idx").on(table.userId),
  ]
);

// ── Rate Limit Counters ──

export const rateLimitCounters = mysqlTable(
  "rate_limit_counters",
  {
    id: int("id").primaryKey().autoincrement(),
    scope: varchar("scope", { length: 32 }).notNull(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    windowStart: datetime("window_start_UTC", { mode: "date" }).notNull(),
    requestCount: int("request_count").notNull().default(0),
    ...archivable,
  },
  (table) => [
    uniqueIndex("rate_limit_scope_ident_window_unique").on(
      table.scope,
      table.identifier,
      table.windowStart
    ),
    index("rate_limit_lookup_idx").on(
      table.scope,
      table.identifier,
      table.windowStart
    ),
    index("rate_limit_archived_updated_idx").on(table.archivedAt, table.updatedAt),
  ]
);

// ── Exchange Rates ──

export const exchangeRates = mysqlTable(
  "exchange_rates",
  {
    id: int("id").primaryKey().autoincrement(),
    baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
    targetCurrency: varchar("target_currency", { length: 3 }).notNull(),
    rate: decimal("rate", { precision: 16, scale: 8 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: datetime("created_at_UTC", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exchange_rates_pair_date_unique").on(
      table.baseCurrency,
      table.targetCurrency,
      table.date
    ),
    index("exchange_rates_lookup_idx").on(
      table.baseCurrency,
      table.targetCurrency,
      table.date
    ),
  ]
);
