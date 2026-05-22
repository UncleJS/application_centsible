# Centsible

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey?style=flat)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.3-f9f1e1?style=flat&logo=bun)](https://bun.sh)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?style=flat&logo=vite)](https://vite.dev)
[![MariaDB](https://img.shields.io/badge/MariaDB-11-003545?style=flat&logo=mariadb)](https://mariadb.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org)

A self-hosted personal finance tracker. Track income and expenses, set monthly budgets, monitor recurring subscriptions, manage savings goals, and forecast future spending — all in one place.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start (Container Stack)](#quick-start-container-stack)
- [Uninstall / Teardown](#uninstall--teardown)
- [Documentation](#documentation)
- [Project Layout](#project-layout)
- [Default Categories](#default-categories)

---

## Features

- **Transaction tracking** — Income and expense records with category, date, currency, and description
- **Monthly budgets** — Per-category spending limits with real-time `spent` calculations
- **Subscription management** — Recurring payments with renewal date tracking and upcoming-renewal alerts
- **Savings goals** — Target amounts, contribution history, and projected monthly contributions in forecasts
- **Multi-currency** — Every record carries its own currency; exchange rates fetched from [Frankfurter](https://www.frankfurter.app/) and cached locally
- **Reports & forecasting** — Monthly summaries, category breakdowns, historical trend charts, and up to 12-month expense forecasts
- **CSV export** — Download any month's transactions as a spreadsheet-safe CSV
- **Secure sessions** — HttpOnly cookie-based auth (JWT access + refresh tokens) with CSRF protection
- **End-to-end tested** — Playwright suite runs every screen against a real Elysia API + Vite preview build + a dedicated `centsible_test` MariaDB schema

[↑ Go to TOC](#table-of-contents)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + React Router 7, Tailwind CSS v4, shadcn/ui, Zustand |
| Backend | Bun + Elysia, `@elysiajs/jwt`, `@elysiajs/swagger` |
| Database | MariaDB 11 + Drizzle ORM |
| Shared | TypeScript types + Zod validation (`@centsible/shared`) |
| Testing | Bun test (API unit suites) + Playwright (web E2E against the full stack) |
| Deployment | Rootless Podman + systemd Quadlet |

[↑ Go to TOC](#table-of-contents)

---

## Quick Start (Container Stack)

**Prerequisites:** rootless [Podman](https://podman.io/), `systemd --user`, and Bun available on the host for repo tooling.

```bash
# 1. Create the repo-local env file
cp .env.example .env
# Edit .env — set MARIADB_*, JWT_SECRET, JWT_REFRESH_SECRET to real values.

# 2. One-shot bootstrap — builds all three images, installs Quadlets
#    (stamping the absolute .env path into each unit), starts the pod.
./scripts/install.sh
```

Day-to-day lifecycle commands:

```bash
./scripts/start.sh      # start the pod
./scripts/stop.sh       # stop the pod
./scripts/restart.sh    # stop then start
./scripts/rebuild.sh    # verify, stop, rebuild all images, start
./scripts/logs.sh       # tail journal for all centsible services
./scripts/seed.sh       # seed the database via centsible-api
```

- Web: http://localhost:10300
- API: http://localhost:10301
- Swagger UI: http://localhost:10301/docs

The `centsible-dev` container is a utility/build container inside the `centsible` pod. It does **not** publish the app; the serving endpoints above belong to `centsible-web` and `centsible-api`.

If you specifically want the direct non-container Bun workflow, see [docs/development.md](docs/development.md).

[↑ Go to TOC](#table-of-contents)

---

## Uninstall / Teardown

For production-style Podman + Quadlet installs:

```bash
# Remove installed Quadlet files and runtime, keep DB data
./scripts/teardown.sh

# Also remove local images
./scripts/teardown.sh --remove-images

# Also purge the MariaDB named volume (destructive)
./scripts/teardown.sh --purge-volumes

# Full wipe (volumes + images)
./scripts/teardown.sh --remove-images --purge-volumes
```

Database data is preserved unless `--purge-volumes` is provided.

See [docs/deployment.md](docs/deployment.md) for the full uninstall order and volume details.

[↑ Go to TOC](#table-of-contents)

---

## Documentation

| Document | Description |
|---|---|
| [docs/user-guide.md](docs/user-guide.md) | End-user guide — every feature, calculation rules, multi-currency behaviour, data lifecycle |
| [docs/development.md](docs/development.md) | Local setup, monorepo layout, environment variables, database workflow, code conventions |
| [docs/deployment.md](docs/deployment.md) | Production deployment with Podman + systemd Quadlet, secrets, upgrades, rollback |
| [docs/api.md](docs/api.md) | Full API reference — every endpoint, query params, request/response shapes, auth model |

[↑ Go to TOC](#table-of-contents)

---

## Project Layout

```
application_centsible/
├── packages/
│   ├── api/          # Bun + Elysia backend (port 4000 / 10301)
│   ├── web/          # React + Vite frontend (port 3000 / 10300)
│   └── shared/       # TypeScript types + Zod schemas shared across both
├── infra/
│   ├── Containerfile.api       # Multi-stage Podman build for the API
│   ├── Containerfile.web       # Multi-stage Podman build for the web app
│   ├── api-entrypoint.sh       # Waits for DB, runs migrations, starts API
│   └── quadlet/                # systemd Quadlet unit files
│       ├── centsible.pod
│       ├── centsible-api.container
│       ├── centsible-db.volume
│       ├── centsible-dev.container
│       ├── centsible-web.container
│       └── centsible-mariadb.container
├── scripts/
│   ├── lib/common.sh           # shared constants + helpers
│   ├── install.sh              # full bootstrap (build + install + start)
│   ├── rebuild.sh              # verify, stop, rebuild all images, start
│   ├── start.sh / stop.sh / restart.sh
│   ├── teardown.sh             # uninstall; --remove-images, --purge-volumes
│   ├── logs.sh                 # tail journal for all centsible services
│   └── seed.sh                 # run database seed inside centsible-api
├── .env.example      # Repo-local env template (dev + Quadlet stack)
└── bun.lock
```

[↑ Go to TOC](#table-of-contents)

---

## Default Categories

New accounts are seeded with 14 expense categories (Food & Groceries, Transport, Housing, …) and 5 income categories (Salary, Freelance, Investments, …). All categories are user-owned and fully editable.

[↑ Go to TOC](#table-of-contents)

---

&copy; 2026 UncleJs — Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
