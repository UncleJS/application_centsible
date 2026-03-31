# Centsible Web

[![Web Smoke](https://github.com/UncleJS/application_centsible/actions/workflows/web-smoke.yml/badge.svg)](https://github.com/UncleJS/application_centsible/actions/workflows/web-smoke.yml)

Next.js frontend for Centsible.

## Containerized workflow

Run package commands inside the project dev container:

```bash
podman exec centsible-dev bun run --filter @centsible/web typecheck
podman exec centsible-dev bun run --filter @centsible/web lint
podman exec centsible-dev env -u NODE_ENV bun run --filter @centsible/web build
podman exec centsible-dev bun run --filter @centsible/web test:smoke
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

## Smoke tests

Playwright smoke coverage verifies:

- legacy redirects land on grouped routes
- redirect tracking params are preserved/appended correctly
- grouped pages render with mocked authenticated state
- desktop and mobile navigation expose the regrouped information architecture
