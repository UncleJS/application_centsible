# Development Guide

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
- [Code Conventions](#code-conventions)

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| [Bun](https://bun.sh) | 1.3 | Package manager, API runtime, build tool |
| [MariaDB](https://mariadb.org) | 11 | Database (MySQL-compatible) |
| Node.js | 20 *(optional)* | Only needed if you encounter Next.js build issues with Bun |

> **Tip:** On macOS/Linux you can run MariaDB with `brew install mariadb && brew services start mariadb` or via a rootless Podman container: `podman run -d --name mariadb -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=centsible -e MARIADB_USER=centsible -e MARIADB_PASSWORD=centsible_dev -p 3306:3306 docker.io/library/mariadb:11.7`

---

## Monorepo Layout

```
application_centsible/
├── packages/
│   ├── api/                  # @centsible/api  — Bun + Elysia backend
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point — wires up Elysia app
│   │   │   ├── config.ts         # Centralised env config (crashes if secrets missing in prod)
│   │   │   ├── auth/
│   │   │   │   └── session.ts    # Cookie helpers + CSRF token generation
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     # Drizzle ORM table definitions
│   │   │   │   ├── index.ts      # mysql2 connection pool + Drizzle instance
│   │   │   │   ├── migrate.ts    # Runs pending migrations
│   │   │   │   └── seed.ts       # Populates dev data
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts       # JWT + cookie auth, CSRF enforcement
│   │   │   │   └── rate-limit.ts # Sliding-window rate limiter
│   │   │   └── routes/
│   │   │       ├── auth.ts
│   │   │       ├── categories.ts
│   │   │       ├── transactions.ts
│   │   │       ├── budgets.ts
│   │   │       ├── savings-goals.ts
│   │   │       ├── subscriptions.ts
│   │   │       ├── reports.ts
│   │   │       └── exchange-rates.ts
│   │   ├── drizzle/              # Auto-generated SQL migrations (do not hand-edit)
│   │   └── drizzle.config.ts     # Drizzle Kit config
│   │
│   ├── web/                  # @centsible/web  — Next.js 16 App Router frontend
│   │   └── src/
│   │       ├── app/              # Next.js pages (App Router)
│   │       ├── components/
│   │       │   ├── ui/           # shadcn base components
│   │       │   └── layout/       # AppShell + Sidebar
│   │       └── lib/
│   │           ├── api.ts        # Typed API client (fetch wrapper, auto-refresh, CSRF)
│   │           ├── store.ts      # Zustand auth store
│   │           └── format.ts     # Currency / date formatters
│   │
│   └── shared/               # @centsible/shared — types + validation
│       └── src/
│           ├── types.ts          # TypeScript interfaces for all entities
│           ├── validation.ts     # Zod schemas used by both API and web
│           └── constants.ts      # Currencies, default categories, billing cycles
│
├── infra/                    # Container and deploy artefacts
├── .env.example              # Template for local .env
├── bun.lock
└── package.json              # Workspace root with shared scripts
```

Bun workspaces link the packages so that `import { User } from "@centsible/shared"` works in both `api` and `web` without a build step.

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
| `JWT_SECRET` | *(dev default, printed warning)* | Secret for signing access tokens (15 min TTL) |
| `JWT_REFRESH_SECRET` | *(dev default, printed warning)* | Secret for signing refresh tokens (7 day TTL). **Must differ from JWT_SECRET.** |
| `WEB_URL` | `http://localhost:3000` | CORS allowed origin — must match the web app URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API base URL used by the Next.js app |

> **Security note:** In production `config.ts` throws a hard error if `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME` are missing. Dev defaults are intentionally weak and print a console warning.

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

---

## Available Scripts

All scripts run from the **project root**:

| Script | What it does |
|---|---|
| `bun run dev` | Starts API (`:4000`) and web (`:3000`) concurrently |
| `bun run dev:api` | API only, with `--watch` hot reload |
| `bun run dev:web` | Web only (`next dev`) |
| `bun run build` | Production build of all packages |
| `bun run db:generate` | Generate a new migration from schema changes |
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

---

## Database Workflow

### Schema changes

1. Edit `packages/api/src/db/schema.ts`
2. Generate the migration SQL:
   ```bash
   bun run db:generate
   ```
   This produces a new file under `packages/api/drizzle/`.
3. Apply it:
   ```bash
   bun run db:migrate
   ```
4. Commit both `schema.ts` **and** the generated migration file together.

> **Never hand-edit files in `packages/api/drizzle/`** — they are auto-generated by Drizzle Kit and the content must match what `drizzle-kit` produces.

### Archive-only data lifecycle

**No table in this project uses hard deletes.** Every archivable table has an `archivedAt` column (`datetime`, nullable). "Deleting" a record sets `archivedAt = NOW()`. All list queries filter with `WHERE archived_at IS NULL`.

To restore an archived record, set `archivedAt = NULL` directly in Drizzle Studio or via the restore endpoint (categories only currently have a restore route at `POST /categories/:id/restore`).

### Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `savings_goals` |
| Column names | `snake_case` | `target_amount` |
| Drizzle field names | `camelCase` | `targetAmount` |
| Amounts | `DECIMAL(12,2)` string | `"1234.56"` |
| Dates | `DATE` as `YYYY-MM-DD` string | `"2026-03-01"` |
| Timestamps | `DATETIME` as JS `Date` | `new Date()` |

---

## Architecture Overview

```
Browser
  └── Next.js (App Router, SSR disabled for auth pages)
        └── ApiClient (lib/api.ts)  ←── credentials: "include", X-CSRF-Token header
              │
              ▼ HTTP (fetch)
        Elysia API (Bun)
              ├── CORS middleware — origin: WEB_URL only
              ├── generalRateLimit — 100 req/min/IP
              ├── authMiddleware — JWT from cookie or Authorization header
              ├── Route handlers — Drizzle ORM queries
              └── SwaggerUI at /docs (dev only)
                    │
                    ▼ mysql2 connection pool (max 10)
              MariaDB 11
```

### Request flow for a protected endpoint

1. Browser sends `fetch(url, { credentials: "include" })` — cookies are included automatically.
2. For `POST`/`PATCH`/`DELETE`, `ApiClient` reads `centsible_csrf_token` from `document.cookie` and sets `X-CSRF-Token: <value>` header.
3. `authMiddleware` reads the `centsible_access_token` HttpOnly cookie (or `Authorization: Bearer` header).
4. If cookie-authenticated, the CSRF header is validated against the CSRF cookie (double-submit pattern).
5. If the access token is expired (401), `ApiClient.tryRefresh()` sends `POST /auth/refresh` (also cookie-only) to silently rotate tokens, then retries the original request once.
6. If refresh also fails, `useAuthStore.onAuthError` clears localStorage and redirects to `/login`.

---

## Auth & Session Model

### Tokens

| Token | TTL | Storage | Readable by JS |
|---|---|---|---|
| Access token | 15 minutes | `centsible_access_token` HttpOnly cookie | No |
| Refresh token | 7 days | `centsible_refresh_token` HttpOnly cookie | No |
| CSRF token | 7 days | `centsible_csrf_token` cookie | Yes (no `HttpOnly`) |

### Token rotation

Every successful `POST /auth/refresh` call:
1. Validates the refresh token hash against the `refresh_tokens` table.
2. Revokes the old token (`revokedAt = NOW()`).
3. Prunes all expired/revoked tokens for the user.
4. Issues a fresh access + refresh token pair via new cookies.
5. Issues a new CSRF token.

### Refresh token storage

Refresh tokens are **not stored in plain text**. The raw JWT is hashed with Argon2 before being written to `refresh_tokens.token_hash`. On validation, the incoming token is hashed and compared.

### CSRF protection

All mutating requests (`POST`, `PATCH`, `DELETE`) that arrive **without** an `Authorization: Bearer` header require:
- A `centsible_csrf_token` cookie to be present.
- An `X-CSRF-Token` request header with the **same value**.

Bearer-token authenticated requests (e.g. mobile apps, server-to-server) skip the CSRF check.

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
  detail: { tags: ["My Feature"] },   // groups in Swagger
})
  .use(authMiddleware)                  // inject `user` into context
  .get("/", async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.myTable)
      .where(and(
        eq(schema.myTable.userId, user.id),
        isNull(schema.myTable.archivedAt),
      ));
    return { data: rows };
  });
```

2. Register it in `packages/api/src/index.ts`:

```typescript
import { myFeatureRoutes } from "./routes/my-feature";
// ...
app.use(myFeatureRoutes)
```

3. If you need a new table, update `schema.ts` and run `bun run db:generate && bun run db:migrate`.

4. Add the corresponding TypeScript types to `packages/shared/src/types.ts` and Zod schemas to `packages/shared/src/validation.ts` if the web app needs them.

### Route conventions

- Return `{ data: ... }` on success.
- Return `{ error: "..." }` with an appropriate `set.status` on failure.
- Always filter by `userId` and `isNull(archivedAt)`.
- Soft-delete only: `set({ archivedAt: new Date() })`.
- Amounts come in as strings matching `/^\d+(\.\d{1,2})?$/` and are stored as `DECIMAL(12,2)`.
- Dates come in as strings matching `/^\d{4}-\d{2}-\d{2}$/`.

---

## Adding a Frontend Page

1. Create `packages/web/src/app/my-page/page.tsx`.
2. Wrap the page content in `<AppShell>` (imported from `@/components/layout/app-shell`) — this handles authentication gating and provides the sidebar.
3. Call the API through the typed client in `lib/api.ts`. Add a method there if one doesn't exist.
4. Add the nav link to `packages/web/src/components/layout/sidebar.tsx`.

### API client usage

```typescript
import { api } from "@/lib/api";

// GET (no CSRF needed)
const result = await api.getTransactions({ page: 1, pageSize: 20 });

// POST / PATCH / DELETE (CSRF injected automatically)
await api.createTransaction({ ... });
```

### State management

Use React `useState` / `useEffect` for local page state. The only global Zustand store is `useAuthStore` (user identity, login/logout/hydrate). Do not put server data in global state.

---

## Working with Shared Types

`packages/shared/src/types.ts` defines all entity interfaces. `packages/shared/src/validation.ts` defines Zod schemas that mirror and extend the types.

Rules:
- **If you add a column to the DB**, add the corresponding field to the TypeScript interface in `types.ts`.
- **If the field is user-supplied input**, add a Zod rule to `validation.ts` and use that schema in the Elysia route body/query validator.
- **Never import directly from `packages/shared/src/...`** in app code. Always import from `@centsible/shared` (the workspace alias).

---

## Code Conventions

### TypeScript

- Strict mode is on. No `any` except in Elysia context casts (necessary due to framework typing limitations).
- Prefer `const` over `let`. No `var`.
- Use explicit return types on exported functions.

### Naming

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- DB columns → Drizzle fields: `snake_case` in DB, `camelCase` in TS (Drizzle handles the mapping)

### Imports

Path aliases available in the web package (`tsconfig.json`):

```
@/           →  packages/web/src/
@centsible/shared  →  packages/shared/src/
```

### Error handling

- API: Set `set.status` and return `{ error: "message" }`. Never throw unhandled promises.
- Frontend: Use `try/catch` around `api.*` calls. Show errors with `sonner` toast (`import { toast } from "sonner"`).

### Formatting

The project uses the default Bun/TypeScript code style. No formatter is currently enforced by a pre-commit hook — keep diffs clean by not reformatting unrelated files.
