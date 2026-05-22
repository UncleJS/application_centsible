# Centsible Web

[![Web E2E](https://github.com/UncleJS/application_centsible/actions/workflows/web-e2e.yml/badge.svg)](https://github.com/UncleJS/application_centsible/actions/workflows/web-e2e.yml)

React + Vite SPA frontend for Centsible. Routes are declared in `src/router.tsx` and rendered via React Router 7.

## Containerized workflow

Run package commands inside the project dev container:

```bash
podman exec centsible-dev bun run --filter @centsible/web typecheck
podman exec centsible-dev bun run --filter @centsible/web lint
podman exec centsible-dev env -u NODE_ENV bun run --filter @centsible/web build
podman exec centsible-dev bun run --filter @centsible/web test:e2e
```

## Route grouping

Primary grouped destinations:

- `/dashboard`
- `/budgets`
- `/categories`
- `/recurring/subscriptions`
- `/recurring/income`
- `/savings`
- `/insights/reports`
- `/insights/forecast`

Legacy routes remain available as redirects for compatibility.

## Legacy redirect tracking

Legacy routes are redirected in app code instead of static config redirects because the redirect needs to preserve incoming query params and append tracking params when missing.

Tracked legacy routes:

- `/subscriptions` -> `/recurring/subscriptions`
- `/reports` -> `/insights/reports`
- `/forecast` -> `/insights/forecast`
- `/categories/expense` -> `/categories?tab=expense`
- `/categories/income` -> `/categories?tab=income`

Redirect tracking params appended when absent:

- `utm_source=legacy-route`
- `utm_medium=redirect`
- `utm_campaign=navigation-regrouping`
- `utm_content=<legacy route>`

Rules:

- existing query params are preserved
- existing UTM values are not overwritten
- `utm_content` identifies the legacy source route

## End-to-end tests

Playwright E2E coverage runs against a real Elysia API + Vite preview build
+ dedicated `centsible_test` MariaDB schema. Specs live in `tests/e2e/` and
cover auth, transactions, budgets, subscriptions, recurring income, savings
goals, categories, reports, forecast, settings, CSV export, currency
conversion, validation, pagination, and empty states. See
`playwright.config.e2e.ts` for the port + DB wiring.
