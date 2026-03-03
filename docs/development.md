# Development Guide

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey?style=flat)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.3-f9f1e1?style=flat&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![MariaDB](https://img.shields.io/badge/MariaDB-11-003545?style=flat&logo=mariadb)](https://mariadb.org)

This document covers everything you need to get Centsible running locally, understand the codebase, and contribute changes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Monorepo Layout](#monorepo-layout)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Available Scripts](#available-scripts)
- [Database Workflow](#database-workflow)
- [Architecture Overview](#architecture-overview)
- [Auth & Session Model](#auth--session-model)
- [Adding a New API Route](#adding-a-new-api-route)
- [Adding a Frontend Page](#adding-a-frontend-page)
- [Working with Shared Types](#working-with-shared-types)
- [Shared Constants](#shared-constants)
- [Validation Schemas](#validation-schemas)
- [Code Conventions](#code-conventions)

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| [Bun](https://bun.sh) | 1.3 | Package manager, API runtime, build tool |
| [MariaDB](https://mariadb.org) | 11 | Database (MySQL-compatible) |
| Node.js | 20 *(optional)* | Only needed if you encounter Next.js build issues with Bun |

> **Tip:** On macOS/Linux you can run MariaDB with `brew install mariadb && brew services start mariadb` or via a rootless Podman container:
> ```bash
> podman run -d --name mariadb \
>   -e MARIADB_ROOT_PASSWORD=root \
>   -e MARIADB_DATABASE=centsible \
>   -e MARIADB_USER=centsible \
>   -e MARIADB_PASSWORD=centsible_dev \
>   -p 3306:3306 \
>   docker.io/library/mariadb:11.7
> ```

[↑ Go to TOC](#table-of-contents)

---

## Monorepo Layout

```
application_centsible/
├── packages/
│   ├── api/                  # @centsible/api  — Bun + Elysia backend
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point — wires up Elysia app, registers all routes
│   │   │   ├── config.ts             # Centralised env config (crashes if secrets missing in prod)
│   │   │   ├── auth/
│   │   │   │   └── session.ts        # Cookie helpers + CSRF token generation
│   │   │   ├── db/
│   │   │   │   ├── schema.ts         # Drizzle ORM table definitions (all 9 tables)
│   │   │   │   ├── index.ts          # mysql2 connection pool + Drizzle instance
│   │   │   │   ├── migrate.ts        # Runs pending Drizzle migrations
│   │   │   │   └── seed.ts           # Populates dev data
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT + cookie auth, CSRF enforcement, injects `user` into ctx
│   │   │   │   └── rate-limit.ts     # Sliding-window in-memory rate limiter (auth: 10/min, general: 100/min)
│   │   │   └── routes/
│   │   │       ├── auth.ts           # POST /auth/register|login|refresh|logout, GET/PATCH /auth/me
│   │   │       ├── categories.ts     # GET/POST /categories, PATCH/DELETE /categories/:id, POST /categories/:id/restore
│   │   │       ├── transactions.ts   # GET/POST /transactions, PATCH/DELETE /transactions/:id
│   │   │       ├── budgets.ts        # GET/POST /budgets, PATCH/DELETE /budgets/:id
│   │   │       ├── savings-goals.ts  # GET/POST /savings-goals, GET/PATCH/DELETE /savings-goals/:id, POST /savings-goals/:id/contribute
│   │   │       ├── subscriptions.ts  # GET/POST /subscriptions, GET /subscriptions/upcoming, PATCH/DELETE /subscriptions/:id
│   │   │       ├── recurring-income.ts # GET/POST /recurring-income, PATCH/DELETE /recurring-income/:id
│   │   │       ├── reports.ts        # GET /reports/summary|forecast|trend|export
│   │   │       └── exchange-rates.ts # GET /exchange-rates/latest|convert|currencies
│   │   ├── drizzle/                  # Auto-generated SQL migrations (do not hand-edit)
│   │   └── drizzle.config.ts         # Drizzle Kit config
│   │
│   ├── web/                  # @centsible/web  — Next.js App Router frontend
│   │   └── src/
│   │       ├── app/              # Next.js pages (App Router)
│   │       │   ├── dashboard/page.tsx      # Overview: income, expenses, net savings, budget usage
│   │       │   ├── transactions/page.tsx   # Transaction list + create/edit/delete
│   │       │   ├── budgets/page.tsx        # Monthly budgets + Projected Balance
│   │       │   ├── savings/page.tsx        # Savings goals + contributions
│   │       │   ├── subscriptions/page.tsx  # Subscription tracker
│   │       │   ├── recurring-income/page.tsx # Recurring income sources
│   │       │   ├── forecast/page.tsx       # Forward-looking monthly forecast
│   │       │   ├── reports/page.tsx        # Monthly trend charts + CSV export
│   │       │   ├── settings/page.tsx       # Profile, currency, categories
│   │       │   ├── login/page.tsx
│   │       │   └── register/page.tsx
│   │       ├── components/
│   │       │   ├── ui/               # shadcn/ui base components
│   │       │   └── layout/           # AppShell + Sidebar
│   │       └── lib/
│   │           ├── api.ts            # Typed ApiClient (fetch wrapper, auto-refresh, CSRF injection)
│   │           ├── store.ts          # Zustand auth store (user identity only)
│   │           └── format.ts         # Currency / date formatters
│   │
│   └── shared/               # @centsible/shared — types + validation + constants
│       └── src/
│           ├── types.ts          # TypeScript interfaces for all domain entities and API response shapes
│           ├── validation.ts     # Zod schemas used by both API (route validators) and web (form validation)
│           └── constants.ts      # Currencies, default categories, billing cycle labels/multipliers
│
├── infra/                    # Container and deploy artefacts
│   ├── deploy.sh             # Build + install + start/stop/logs/seed script
│   ├── Containerfile.api     # Multi-stage build for the Bun/Elysia API
│   ├── Containerfile.web     # Multi-stage build for the Next.js frontend
│   ├── api-entrypoint.sh     # DB readiness check + migration runner + process exec
│   ├── .env.centsible.example # Template for production secrets
│   └── quadlet/
│       ├── centsible.pod                # Podman pod definition (ports 10300, 10301)
│       ├── centsible-mariadb.container  # MariaDB 11.7
│       ├── centsible-api.container      # API container in pod
│       └── centsible-web.container      # Web container in pod
│
├── docs/                     # Technical and user documentation
│   ├── development.md        # This file
│   ├── deployment.md         # Production deployment guide
│   ├── api.md                # Full API reference
│   └── user-guide.md         # End-user documentation
│
├── .env.example              # Template for local development .env
├── bunfig.toml               # Bun workspace configuration
├── bun.lock
└── package.json              # Workspace root with shared scripts
```

Bun workspaces link the packages so that `import { User } from "@centsible/shared"` works in both `api` and `web` without a build step.

[↑ Go to TOC](#table-of-contents)

---

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill in the values:

```bash
cp .env.example .env
```

| Variable | Default (dev) | Description |
|---|---|---|
| `DB_HOST` | `localhost` | MariaDB host |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_USER` | `centsible` | Database user |
| `DB_PASSWORD` | `centsible_dev` | Database password |
| `DB_NAME` | `centsible` | Database name |
| `API_PORT` | `4000` | Port the Elysia API listens on |
| `JWT_SECRET` | *(dev default, prints warning)* | Secret for signing access tokens (15 min TTL) |
| `JWT_REFRESH_SECRET` | *(dev default, prints warning)* | Secret for signing refresh tokens (7 day TTL). **Must differ from `JWT_SECRET`.** |
| `WEB_URL` | `http://localhost:3000` | CORS allowed origin — must exactly match the web app origin (scheme + host + port) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API base URL baked into the Next.js bundle at build time |

> **Security note:** In production `config.ts` throws a hard error if `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME` are missing. Dev defaults are intentionally weak and print a `⚠` console warning.

[↑ Go to TOC](#table-of-contents)

---

## Running Locally

### Full stack (recommended)

```bash
bun install          # install all workspace dependencies
bun run db:migrate   # create tables (first time or after schema changes)
bun run dev          # starts API on :4000 AND web on :3000 concurrently
```

### Individual services

```bash
# API only (watch mode — restarts on file changes)
bun run dev:api

# Web only
bun run dev:web
```

### Seed test data

```bash
bun run --filter @centsible/api db:seed
```

### Open Drizzle Studio (visual DB browser)

```bash
bun run db:studio    # opens browser UI at https://local.drizzle.studio
```

[↑ Go to TOC](#table-of-contents)

---

## Available Scripts

All scripts run from the **project root**:

| Script | What it does |
|---|---|
| `bun run dev` | Starts API (`:4000`) and web (`:3000`) concurrently |
| `bun run dev:api` | API only, with `--watch` hot reload |
| `bun run dev:web` | Web only (`next dev`) |
| `bun run build` | Production build of all packages |
| `bun run db:generate` | Generate a new Drizzle migration from schema changes |
| `bun run db:migrate` | Apply pending migrations to the database |
| `bun run db:studio` | Open Drizzle Studio in the browser |
| `bun run typecheck` | Run `tsc --noEmit` in all packages |
| `bun run lint` | Run ESLint in all packages |

Package-specific scripts (run with `bun run --filter @centsible/api <script>`):

| Script | Package | What it does |
|---|---|---|
| `db:seed` | api | Populate database with sample data |
| `start` | api | Run the production bundle (`dist/index.js`) |
| `start` | web | Run the Next.js production build |

[↑ Go to TOC](#table-of-contents)

---

## Database Workflow

### Schema changes

1. Edit `packages/api/src/db/schema.ts`
2. Generate the migration SQL:
   ```bash
   bun run db:generate
   ```
   This produces a new timestamped file under `packages/api/drizzle/`.
3. Apply it:
   ```bash
   bun run db:migrate
   ```
4. Commit both `schema.ts` **and** the generated migration file together.

> **Never hand-edit files in `packages/api/drizzle/`** — they are auto-generated by Drizzle Kit and their content must match exactly what `drizzle-kit` produces.

### Archive-only data lifecycle

**No table in this project uses hard deletes.** Every archivable table has an `archivedAt` column (`DATETIME`, nullable). "Deleting" a record sets `archivedAt = NOW()`. All list queries filter with `WHERE archived_at IS NULL`.

To restore an archived record, set `archivedAt = NULL` directly in Drizzle Studio or via the restore endpoint. Currently only categories have a dedicated restore route (`POST /categories/:id/restore`).

### Table summary

| Table | Archivable | Notes |
|---|---|---|
| `users` | Yes | `passwordHash` never returned in API responses |
| `refresh_tokens` | No | Has `revokedAt`; pruned on every login/refresh |
| `categories` | Yes | `type` is `"income"` or `"expense"`, immutable after creation |
| `transactions` | Yes | `type` must match its category's `type` |
| `budgets` | Yes | Unique on `(userId, categoryId, year, month)` — upserted, not duplicated |
| `savings_goals` | Yes | `currentAmount` is updated atomically via SQL expression on contribution |
| `savings_contributions` | Yes | Archived independently; archiving does not reverse `currentAmount` |
| `subscriptions` | Yes | `billingCycle` drives forecast renewal date calculation |
| `recurring_income` | Yes | `billingCycle` drives forecast income; `autoRenew: false` is excluded from forecasts |
| `exchange_rates` | No | Unique on `(baseCurrency, targetCurrency, date)`; cached from Frankfurter API |

### Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `savings_goals` |
| Column names | `snake_case` | `target_amount` |
| Drizzle field names | `camelCase` | `targetAmount` |
| Amounts | `DECIMAL(12,2)` stored as string | `"1234.56"` |
| Dates | `DATE` as `YYYY-MM-DD` string | `"2026-03-01"` |
| Timestamps | `DATETIME` as JS `Date` | `new Date()` |

[↑ Go to TOC](#table-of-contents)

---

## Architecture Overview

```
Browser
  └── Next.js (App Router — all pages are Client Components)
        └── ApiClient (lib/api.ts)  ←── credentials: "include" + X-CSRF-Token header
              │
              ▼ HTTP (fetch)
        Elysia API (Bun runtime)
              ├── CORS middleware (origin: WEB_URL only, credentials: true)
              ├── generalRateLimit (100 req/min/IP — sliding window, in-memory)
              ├── Global error handler (VALIDATION → 400, other → 500)
              ├── JWT plugins (access: 15 min, refresh: 7 days)
              ├── authMiddleware (derives `user` into ctx for all protected routes)
              ├── Route handlers (Drizzle ORM queries, archive-only mutations)
              └── SwaggerUI at /docs  (non-production only)
                    │
                    ▼ mysql2 connection pool (max 10)
              MariaDB 11 (tables: users, categories, transactions, budgets,
                          savings_goals, savings_contributions, subscriptions,
                          recurring_income, exchange_rates, refresh_tokens)
```

### Request flow for a protected endpoint

1. Browser sends `fetch(url, { credentials: "include" })` — cookies are attached automatically.
2. For `POST`/`PATCH`/`DELETE`, `ApiClient` reads `centsible_csrf_token` from `document.cookie` and sets `X-CSRF-Token: <value>` header.
3. `authMiddleware` reads `centsible_access_token` (HttpOnly cookie) or `Authorization: Bearer <token>`.
4. If cookie-authenticated, CSRF header is validated against the CSRF cookie (double-submit pattern). Mismatch → `403`.
5. JWT is verified; user row is fetched from DB and injected as `ctx.user`.
6. If the access token is expired (`401`), `ApiClient.tryRefresh()` sends `POST /auth/refresh` (mutex-protected to avoid parallel refresh storms), then retries the original request once with `skipRefresh: true`.
7. If refresh also fails, `useAuthStore.onAuthError` clears state and redirects to `/login`.

### Rate limiting implementation

`rate-limit.ts` maintains an in-memory `Map<string, { timestamps: number[] }>` keyed by `"auth:<ip>"` or `"general:<ip>"`. A `setInterval` every 5 minutes prunes entries with no recent timestamps to prevent unbounded memory growth.

- IP resolution order: `X-Forwarded-For` (first value) → `X-Real-IP` → `"unknown"`
- Auth endpoints: **10 requests / 60 s** per IP
- All other endpoints: **100 requests / 60 s** per IP

> **Note:** The rate limiter is in-memory and resets on process restart. It is not shared between multiple API instances.

[↑ Go to TOC](#table-of-contents)

---

## Auth & Session Model

### Tokens

| Token | TTL | Cookie name | `HttpOnly` | Readable by JS |
|---|---|---|---|---|
| Access token | 15 minutes | `centsible_access_token` | Yes | No |
| Refresh token | 7 days | `centsible_refresh_token` | Yes | No |
| CSRF token | 7 days | `centsible_csrf_token` | No | Yes |

### Token rotation

Every successful `POST /auth/refresh`:

1. Validates the refresh token hash against the `refresh_tokens` table (Argon2 comparison).
2. Revokes the old token (`revokedAt = NOW()`).
3. Prunes all expired/revoked tokens for the user from the table.
4. Issues a fresh access + refresh token pair as new cookies.
5. Issues a new CSRF token.

### Refresh token storage

Refresh tokens are **not stored in plain text**. The raw JWT is hashed with **Argon2** before being written to `refresh_tokens.token_hash`. On validation, the incoming token is hashed and compared. This means even if the `refresh_tokens` table is compromised, the raw tokens cannot be extracted.

### CSRF protection

All mutating requests (`POST`, `PATCH`, `DELETE`) that arrive **without** an `Authorization: Bearer` header require:

- A `centsible_csrf_token` cookie to be present.
- An `X-CSRF-Token` request header with the **same value** as the cookie.

Bearer-token authenticated requests (e.g. mobile apps, server-to-server) skip the CSRF check entirely.

`GET` and `HEAD` requests never require a CSRF token.

[↑ Go to TOC](#table-of-contents)

---

## Adding a New API Route

1. Create `packages/api/src/routes/my-feature.ts`:

```typescript
import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull } from "drizzle-orm";

export const myFeatureRoutes = new Elysia({
  prefix: "/my-feature",
  detail: { tags: ["My Feature"] },   // groups endpoints in Swagger UI
})
  .use(authMiddleware)                  // injects `user` into every handler's context
  .get("/", async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.myTable)
      .where(and(
        eq(schema.myTable.userId, user.id),
        isNull(schema.myTable.archivedAt),   // archive-only: always filter
      ));
    return { data: rows };
  })
  .post("/", async ({ user, body, set }) => {
    // ... insert, return created row
    set.status = 201;
    return { data: newRow };
  }, {
    body: t.Object({ ... })  // Elysia/TypeBox inline validator
  });
```

2. Register it in `packages/api/src/index.ts`:

```typescript
import { myFeatureRoutes } from "./routes/my-feature";
// ...
app.use(myFeatureRoutes)
```

3. If you need a new table, update `schema.ts` and run `bun run db:generate && bun run db:migrate`.

4. Add corresponding TypeScript interfaces to `packages/shared/src/types.ts` and Zod schemas to `packages/shared/src/validation.ts`.

### Route conventions

- Return `{ data: ... }` on success (single resource or array).
- Return `{ error: "..." }` with the appropriate `set.status` on failure.
- Always filter by `userId` AND `isNull(archivedAt)` in every query.
- Soft-delete only: `await db.update(schema.myTable).set({ archivedAt: new Date() }).where(...)`.
- Amounts come in as strings matching `/^\d+(\.\d{1,2})?$/` and are stored as `DECIMAL(12,2)`.
- Dates come in as strings matching `/^\d{4}-\d{2}-\d{2}$/`.
- `201 Created` for resource creation; `200 OK` for updates/deletes.
- Swagger tags are defined in `index.ts` — add your feature tag there.

[↑ Go to TOC](#table-of-contents)

---

## Adding a Frontend Page

1. Create `packages/web/src/app/my-page/page.tsx`.
2. Mark it `"use client"` at the top (all pages are Client Components — no SSR for data fetching).
3. Wrap content in `<AppShell>` (from `@/components/layout/app-shell`) — this handles auth gating (redirect to `/login` if unauthenticated) and provides the sidebar navigation.
4. Call the API through the typed client in `lib/api.ts`. Add a typed method there if one doesn't exist yet.
5. Add a nav link in `packages/web/src/components/layout/sidebar.tsx`.

### API client usage

```typescript
import { api } from "@/lib/api";

// GET (no CSRF needed)
const result = await api.getTransactions({ page: "1", pageSize: "20" });

// POST / PATCH / DELETE (CSRF injected automatically by ApiClient)
await api.createTransaction({ categoryId: 3, type: "expense", amount: "45.00", currency: "GBP", date: "2026-03-14" });
```

### State management

Use React `useState` / `useEffect` for local page state. The only global Zustand store is `useAuthStore` (user identity + login/logout/hydrate). Do **not** put server data in global state — keep it local to the component that fetches it.

### Error handling in components

```typescript
try {
  await api.createTransaction({ ... });
  toast.success("Transaction added");
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Failed to save");
}
```

[↑ Go to TOC](#table-of-contents)

---

## Working with Shared Types

`packages/shared/src/types.ts` defines all domain interfaces. `packages/shared/src/validation.ts` defines Zod schemas that mirror and extend the types.

### Key interfaces

| Interface | Description |
|---|---|
| `User` | Authenticated user profile |
| `Category` | Income/expense category (type immutable) |
| `Transaction` | Single income or expense record |
| `Budget` | Monthly spending/income target per category |
| `SavingsGoal` | A savings target with a deadline |
| `SavingsContribution` | A contribution towards a savings goal |
| `Subscription` | A recurring expense (e.g. Netflix) |
| `RecurringIncome` | A recurring income source (e.g. salary) |
| `ExchangeRate` | A cached currency exchange rate |
| `MonthlySummary` | API response from `GET /reports/summary` |
| `ForecastMonth` | One month in the `GET /reports/forecast` response |
| `ForecastItem` | A single line item in a forecast month |

### `ForecastItem.type` values

| Value | Description |
|---|---|
| `"subscription"` | A subscription renewal (expense) |
| `"budget"` | An expense budget allocation |
| `"savings"` | A projected savings goal contribution (expense) |
| `"recurring-income"` | A recurring income source |
| `"income-budget"` | An income budget allocation |

### Rules

- **If you add a DB column** → add the field to the TypeScript interface in `types.ts`.
- **If the field is user-supplied** → add a Zod rule to `validation.ts` and use that schema in the Elysia route validator.
- **If `ForecastItem.type` gains a new value** → update it in `types.ts` **AND** in the frontend's local `ForecastItem` type inside `packages/web/src/app/forecast/page.tsx` (they are separate).
- **Never import directly from `packages/shared/src/...`** — always import from `@centsible/shared` (the workspace alias).

[↑ Go to TOC](#table-of-contents)

---

## Shared Constants

`packages/shared/src/constants.ts` exports:

### `SUPPORTED_CURRENCIES`

31 ISO 4217 currency codes supported across all amount fields and exchange rate lookups.

### `DEFAULT_EXPENSE_CATEGORIES` / `DEFAULT_INCOME_CATEGORIES`

Seeded for every new user on registration. 14 expense categories + 5 income categories.

### `BILLING_CYCLE_MONTHS`

Maps each `BillingCycle` value to its equivalent number of calendar months. Used in forecast calculations and subscription monthly cost normalisation.

| `BillingCycle` | `BILLING_CYCLE_MONTHS` value | Monthly multiplier |
|---|---|---|
| `weekly` | `1 / 4.33 ≈ 0.231` | `amount × 4.33` |
| `fortnightly` | `1 / 2.17 ≈ 0.461` | `amount × 2.17` |
| `monthly` | `1` | `amount × 1` |
| `quarterly` | `3` | `amount / 3` |
| `yearly` | `12` | `amount / 12` |

**Usage in forecast:** For `recurring-income` items with `cycleMonths <= 1` (weekly/fortnightly/monthly), the source fires every forecast month. For `cycleMonths > 1` (quarterly=3, yearly=12), the source fires only when `(fYear * 12 + fMonth - 1) % round(cycleMonths) === 0`.

**Usage in subscription renewals:** The `getSubscriptionRenewalsInMonth` helper in `reports.ts` steps through actual renewal dates starting from `nextRenewalDate`, advancing by `cycleMonths` per iteration, and collects any dates that fall within the target month.

### `EXCHANGE_RATE_API_BASE`

`https://api.frankfurter.app` — the upstream exchange rate service.

[↑ Go to TOC](#table-of-contents)

---

## Validation Schemas

`packages/shared/src/validation.ts` contains Zod schemas for all user-supplied input. These are used:

- **In the API** as Elysia body/query validators (via `t.Object` wrappers or direct Zod parsing).
- **On the frontend** for form validation before submission.

| Schema | Used for |
|---|---|
| `registerSchema` | `POST /auth/register` body |
| `loginSchema` | `POST /auth/login` body |
| `changePasswordSchema` | Password change flow |
| `createCategorySchema` | `POST /categories` body |
| `updateCategorySchema` | `PATCH /categories/:id` body |
| `createTransactionSchema` | `POST /transactions` body |
| `updateTransactionSchema` | `PATCH /transactions/:id` body |
| `transactionFilterSchema` | `GET /transactions` query params |
| `createBudgetSchema` | `POST /budgets` body |
| `updateBudgetSchema` | `PATCH /budgets/:id` body |
| `createSavingsGoalSchema` | `POST /savings-goals` body |
| `updateSavingsGoalSchema` | `PATCH /savings-goals/:id` body |
| `createContributionSchema` | `POST /savings-goals/:id/contribute` body |
| `createSubscriptionSchema` | `POST /subscriptions` body |
| `updateSubscriptionSchema` | `PATCH /subscriptions/:id` body |
| `forecastQuerySchema` | `GET /reports/forecast` query (`months`: 1–12) |
| `reportQuerySchema` | `GET /reports/summary`, `GET /reports/export` query |

All amount fields validate against `/^\d+(\.\d{1,2})?$/`. All date fields validate against `/^\d{4}-\d{2}-\d{2}$/`. Currency codes are 3-character strings.

[↑ Go to TOC](#table-of-contents)

---

## Code Conventions

### TypeScript

- **Strict mode is on.** No `any` except in Elysia context casts (necessary due to framework typing limitations around cookie access).
- Prefer `const` over `let`. No `var`.
- Use explicit return types on exported functions.
- All amounts flow as **strings** (`"1234.56"`) — never as floating-point numbers except for intermediate arithmetic.

### Naming

- Files: `kebab-case.ts` / `kebab-case.tsx`
- React components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- DB columns → Drizzle fields: `snake_case` in SQL, `camelCase` in TypeScript (Drizzle handles the mapping automatically)

### Imports

Path aliases available in the web package (`tsconfig.json`):

```
@/                →  packages/web/src/
@centsible/shared →  packages/shared/src/
```

### Error handling

- **API:** Set `set.status` and `return { error: "message" }`. Never throw unhandled promises.
- **Frontend:** Use `try/catch` around `api.*` calls. Show errors with `sonner` toast: `import { toast } from "sonner"`.

### Formatting

The project uses the default Bun/TypeScript code style. No formatter is enforced by a pre-commit hook — keep diffs clean by not reformatting unrelated files when making targeted changes.

### Security notes

- Never return `passwordHash` or raw JWT values in API responses.
- Always validate `userId` ownership before reading or mutating any resource.
- Subscription `url` fields are accepted only if they start with `http://` or `https://` (validated by `isSafeUrl` in `lib/api.ts`).
- CSV export sanitises cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return (formula injection prevention).

[↑ Go to TOC](#table-of-contents)

---

&copy; 2026 UncleJs — Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
