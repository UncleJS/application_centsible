# Centsible

A self-hosted personal finance tracker. Track income and expenses, set monthly budgets, monitor recurring subscriptions, manage savings goals, and forecast future spending — all in one place.

## Features

- **Transaction tracking** — Income and expense records with category, date, currency, and description
- **Monthly budgets** — Per-category spending limits with real-time `spent` calculations
- **Subscription management** — Recurring payments with renewal date tracking and upcoming-renewal alerts
- **Savings goals** — Target amounts, contribution history, and projected monthly contributions in forecasts
- **Multi-currency** — Every record carries its own currency; exchange rates fetched from [Frankfurter](https://www.frankfurter.app/) and cached locally
- **Reports & forecasting** — Monthly summaries, category breakdowns, historical trend charts, and up to 12-month expense forecasts
- **CSV export** — Download any month's transactions as a spreadsheet-safe CSV
- **Secure sessions** — HttpOnly cookie-based auth (JWT access + refresh tokens) with CSRF protection

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React 19, Tailwind CSS v4, shadcn/ui, Zustand |
| Backend | Bun + Elysia, `@elysiajs/jwt`, `@elysiajs/swagger` |
| Database | MariaDB 11 + Drizzle ORM |
| Shared | TypeScript types + Zod validation (`@centsible/shared`) |
| Deployment | Rootless Podman + systemd Quadlet |

## Quick Start (Local Development)

**Prerequisites:** [Bun](https://bun.sh) >= 1.3, MariaDB running locally.

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DB credentials, JWT secrets

# 3. Run database migrations
bun run db:migrate

# 4. Start both API and web
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Swagger UI: http://localhost:4000/docs (dev only)

## Documentation

| Document | Description |
|---|---|
| [docs/development.md](docs/development.md) | Local setup, monorepo layout, environment variables, database workflow, code conventions |
| [docs/deployment.md](docs/deployment.md) | Production deployment with Podman + systemd Quadlet, secrets, upgrades, rollback |
| [docs/api.md](docs/api.md) | Full API reference — every endpoint, query params, request/response shapes, auth model |

## Project Layout

```
application_centsible/
├── packages/
│   ├── api/          # Bun + Elysia backend (port 4000 / 10301)
│   ├── web/          # Next.js frontend (port 3000 / 10300)
│   └── shared/       # TypeScript types + Zod schemas shared across both
├── infra/
│   ├── Containerfile.api       # Multi-stage Podman build for the API
│   ├── Containerfile.web       # Multi-stage Podman build for the web app
│   ├── api-entrypoint.sh       # Waits for DB, runs migrations, starts API
│   ├── deploy.sh               # One-command build + deploy helper
│   ├── .env.centsible.example  # Production secrets template
│   └── quadlet/                # systemd Quadlet unit files
│       ├── centsible.pod
│       ├── centsible-api.container
│       ├── centsible-web.container
│       └── centsible-mariadb.container
├── .env.example      # Local development environment template
└── bun.lock
```

## Default Categories

New accounts are seeded with 14 expense categories (Food & Groceries, Transport, Housing, …) and 5 income categories (Salary, Freelance, Investments, …). All categories are user-owned and fully editable.
