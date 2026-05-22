# Deployment Guide

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey?style=flat)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Podman](https://img.shields.io/badge/Podman-%3E%3D4.x-892ca0?style=flat&logo=podman)](https://podman.io)
[![systemd](https://img.shields.io/badge/systemd-Quadlet-0067b8?style=flat)](https://www.freedesktop.org/wiki/Software/systemd/)
[![MariaDB](https://img.shields.io/badge/MariaDB-11-003545?style=flat&logo=mariadb)](https://mariadb.org)

Production deployment uses **rootless Podman** with **systemd Quadlet** units. All four services (pod, MariaDB, API, web) are managed as user-level systemd services — no root access required.

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [First-Time Setup](#first-time-setup)
- [Building Container Images](#building-container-images)
- [Installing Quadlet Units](#installing-quadlet-units)
- [Environment Secrets](#environment-secrets)
- [Protecting Swagger in Production](#protecting-swagger-in-production)
- [Starting & Stopping Services](#starting--stopping-services)
- [Verifying the Deployment](#verifying-the-deployment)
- [Logs](#logs)
- [Upgrading](#upgrading)
- [Rollback](#rollback)
- [Database Operations](#database-operations)
- [Networking](#networking)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
Host (rootless user session)
│
└── systemd user session
      │
      ├── centsible-pod.service        (Podman pod — shared network namespace)
      │     ├── centsible-mariadb      MariaDB 11.8  — port 3306 (pod-internal only)
      │     ├── centsible-api          Bun/Elysia    — port 10301 (exposed)
      │     ├── centsible-web          Caddy + SPA   — port 10300 (exposed)
      │     └── centsible-dev          Utility dev   — no exposed ports
      │
      └── systemd volumes
            └── centsible-db           Persistent MariaDB data
```

All containers share `localhost` within the pod (slirp4netns networking). The API reaches MariaDB at `localhost:3306`. The web app reaches the API at `localhost:10301`. MariaDB is **never exposed** outside the pod.

The `centsible-dev` container runs **inside the same pod** but is **not part of the serving path**. It is a utility container for `podman exec` workflows such as `bun run verify:image` before image builds. If `localhost:10300` or `localhost:10301` are down, inspect `centsible-pod`, `centsible-mariadb`, `centsible-api`, and `centsible-web` first — not `centsible-dev`.

### Exposed ports

| Port | Service |
|---|---|
| `10300` | Web frontend |
| `10301` | API backend |

[↑ Go to TOC](#table-of-contents)

---

## Prerequisites

- A Linux host with:
  - `podman` >= 4.x installed for the deployment user
  - `systemd` user session enabled (`loginctl enable-linger <user>`)
  - Internet access (to pull `docker.io/library/mariadb:11.8`, `docker.io/oven/bun:1.3.14-alpine`, `docker.io/caddy:2-alpine`, and build dependencies)
- Bun installed on the host (for building images from source; or pre-built images transferred in)
- The project source cloned to the host

Enable lingering so the user session starts at boot without an interactive login:

```bash
sudo loginctl enable-linger $USER
```

[↑ Go to TOC](#table-of-contents)

---

## First-Time Setup

The `scripts/install.sh` script automates the full workflow:

```bash
# From the project root
./scripts/install.sh
```

This runs in sequence: **stamp `.env` → build dev/api/web images → install Quadlets → start the pod**.

Day-to-day lifecycle scripts (in `scripts/`):

```bash
./scripts/start.sh       # Start the pod (and all containers in it)
./scripts/stop.sh        # Stop the pod
./scripts/restart.sh     # Stop then start
./scripts/rebuild.sh     # verify:image, stop, rebuild all images, start
./scripts/logs.sh        # Tail journal logs for all centsible services
./scripts/seed.sh        # Seed the database via centsible-api
./scripts/teardown.sh    # Uninstall — see "Uninstalling" below
```

All scripts share `scripts/lib/common.sh` for project constants and helpers, so there is exactly one place that names containers, images, volumes, and units.

[↑ Go to TOC](#table-of-contents)

---

## Building Container Images

Images are built locally — they are **not pushed to a registry**. `scripts/install.sh` and `scripts/rebuild.sh` are the supported entrypoints; both ultimately call:

```bash
# API image
podman build \
  -t centsible-api:latest \
  -f infra/Containerfile.api \
  .

# Web image (VITE_API_URL is baked in at build time)
podman build \
  -t centsible-web:latest \
  -f infra/Containerfile.web \
  --build-arg VITE_API_URL=http://localhost:10301 \
  .
```

### What the builds do

**`Containerfile.api`** (multi-stage):
1. Stage 1 (`build`): Installs all dependencies, bundles `src/index.ts` into a single `dist/index.js` with `bun build --target bun`.
2. Stage 2 (`migrate`): Minimal image that only runs database migrations (used by the entrypoint).
3. Stage 3 (`runtime`): Copies the bundle and migration files; runs as non-root user `centsible` (UID 1001).

**`Containerfile.web`** (multi-stage):
1. Stage 1: Installs all dependencies.
2. Stage 2: Runs `vite build` which produces a static SPA bundle under `packages/web/dist`.
3. Stage 3: A `docker.io/caddy:2-alpine` image with the build output copied to `/srv` and `infra/web/Caddyfile` installed at `/etc/caddy/Caddyfile`. Caddy serves the SPA on `:10300` with HTML5-history fallback.

> **`VITE_API_URL` is baked into the JS bundle at build time.** If you change the API port or host, you must rebuild the web image.

[↑ Go to TOC](#table-of-contents)

---

## Installing Quadlet Units

`scripts/install.sh` (and `scripts/lib/common.sh`'s `install_quadlet_units` helper that it calls) copies the six files from `infra/quadlet/` to `~/.config/containers/systemd/`:

```
~/.config/containers/systemd/
├── centsible.pod
├── centsible-api.container
├── centsible-db.volume
├── centsible-dev.container
├── centsible-web.container
└── centsible-mariadb.container
```

Then runs `systemctl --user daemon-reload` so systemd discovers the new units.

> Quadlet reads these `.pod` and `.container` files and auto-generates the corresponding `.service` units — you never write `.service` files by hand.

[↑ Go to TOC](#table-of-contents)

---

## Environment Secrets

The repo-local `.env` (at the project root) is the single source of truth for
both local development and the Quadlet stack. `./scripts/install.sh`
checks for it; if it doesn't exist, it copies `.env.example` to `.env` and
**exits with an error**, requiring you to fill in real values before proceeding:

```bash
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

At install time, `scripts/install.sh` stamps the absolute path to this file
into each Quadlet unit's `EnvironmentFile=` line — there is no per-user copy
under `~/.config/containers/systemd/`.

### Required values

```ini
# MariaDB credentials (used by the mariadb container on first init)
MARIADB_ROOT_PASSWORD=<strong-random-password>
MARIADB_DATABASE=centsible
MARIADB_USER=centsible
MARIADB_PASSWORD=<strong-random-password>

# API database connection (must match MARIADB_* above)
DB_USER=centsible
DB_PASSWORD=<same-as-MARIADB_PASSWORD>
DB_NAME=centsible

# JWT signing secrets — must be different, at least 64 random characters each
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<different-64-char-random-string>

NODE_ENV=production
WEB_URL=http://localhost:10300
```

Generate strong secrets with:

```bash
openssl rand -base64 48   # run twice for two different secrets
```

> The file is loaded by the `centsible-api.container`, `centsible-web.container`, and `centsible-mariadb.container` units via `EnvironmentFile=<absolute path to repo>/.env`. `scripts/install.sh` substitutes the placeholder `__REPO_ENV__` in the committed Quadlet files with the absolute path before copying them into `~/.config/containers/systemd/`.

[↑ Go to TOC](#table-of-contents)

---

## Protecting Swagger in Production

When `NODE_ENV=production`, the API gates `/docs`, `/docs/*`, and `/openapi.json` behind a static bearer token. This is enforced in `packages/api/src/index.ts` before the Swagger plugin sees the request.

| `DOCS_AUTH_TOKEN` state | Behaviour for `/docs`, `/docs/*`, `/openapi.json` |
|---|---|
| Set (recommended) | Requires `Authorization: Bearer <DOCS_AUTH_TOKEN>`. Missing or wrong token → `401 Unauthorized` with `WWW-Authenticate: Bearer realm="centsible-docs"`. |
| Empty / unset | `503 Service Unavailable` — Swagger is effectively disabled. |

Set the token in `.env` next to your other secrets, then restart the API:

```bash
echo "DOCS_AUTH_TOKEN=$(openssl rand -hex 32)" >> .env
systemctl --user restart centsible-api.service
```

Verify the gate:

```bash
# Without a token — expect 401
curl -i http://localhost:10301/openapi.json

# With a token — expect 200 and the OpenAPI JSON
curl -i -H "Authorization: Bearer $DOCS_AUTH_TOKEN" http://localhost:10301/docs/json
```

In development (`NODE_ENV=development`) the gate is bypassed entirely and Swagger UI is reachable at `http://localhost:4000/docs` without a token. Token comparison uses `crypto.timingSafeEqual`, so length-based timing attacks on the token are not viable.

[↑ Go to TOC](#table-of-contents)

---

## Starting & Stopping Services

```bash
# Start everything (pod + all containers)
./scripts/start.sh
# or directly:
systemctl --user start centsible-pod.service

# Stop everything
./scripts/stop.sh
# or directly:
systemctl --user stop centsible-pod.service

# Stop then start
./scripts/restart.sh

# Restart a single service (no script wrapper — talk to systemd directly)
systemctl --user restart centsible-api.service
systemctl --user restart centsible-web.service
```

The start order is enforced by systemd `Requires=` and `After=` directives:

```
centsible-pod  →  centsible-mariadb  →  centsible-api  →  centsible-web
```

The API container's entrypoint (`api-entrypoint.sh`) additionally polls `DB_HOST:DB_PORT` with a TCP check (up to 30 retries × 2 s = 60 s) before running migrations and starting the server, providing an extra safety net against race conditions.

### Enable at boot

```bash
systemctl --user enable centsible-pod.service
```

## Uninstalling Centsible

```bash
# Remove installed Quadlet files and runtime, keep DB volume data
./scripts/teardown.sh

# Also remove locally built images
./scripts/teardown.sh --remove-images

# Also purge the MariaDB named volume (destructive)
./scripts/teardown.sh --purge-volumes

# Full teardown
./scripts/teardown.sh --remove-images --purge-volumes
```

The uninstall flow performs teardown in this order:

1. `systemctl --user stop ...`
2. `systemctl --user disable ...`
3. `systemctl --user reset-failed ...`
4. `podman pod rm -f centsible`
5. `podman rm -f ...` for project containers
6. optional `podman image rm -f ...`
7. remove copied Quadlet files from `~/.config/containers/systemd/`
8. `systemctl --user daemon-reload`
9. optional `podman volume rm -f centsible-db`

> `--purge-volumes` is destructive. Without it, the MariaDB data volume is preserved.

[↑ Go to TOC](#table-of-contents)

---

## Verifying the Deployment

```bash
# Check all service statuses
systemctl --user status centsible-pod.service
systemctl --user status centsible-mariadb.service
systemctl --user status centsible-api.service
systemctl --user status centsible-web.service
systemctl --user status centsible-dev.service

# Compact service state view
systemctl --user --no-pager --full status \
  centsible-pod.service \
  centsible-mariadb.service \
  centsible-api.service \
  centsible-web.service \
  centsible-dev.service

# Podman runtime view
podman pod ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'
podman ps --filter "pod=centsible" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
podman ps --filter "name=centsible-dev" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

# Published ports
podman port centsible-web
podman port centsible-api

# Health check the API
curl http://localhost:10301/health
# Expected: {"status":"ok","db":"ok","timestamp":"..."}
# A 503 with {"status":"error","db":"unreachable",...} means MariaDB is not responding.

# Check the web app is responding
curl -I http://localhost:10300
# Expected: HTTP/1.1 200 OK

# Confirm the utility container used for pre-build verification exists
podman exec centsible-dev bun run verify:image
```

### Exact commands to inspect the stack yourself

```bash
# Services
systemctl --user status centsible-pod.service
systemctl --user status centsible-mariadb.service
systemctl --user status centsible-api.service
systemctl --user status centsible-web.service
systemctl --user status centsible-dev.service

# Containers and pod
podman pod ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'
podman ps --filter "pod=centsible" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
podman ps --filter "name=centsible-dev" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

# Logs
journalctl --user -u centsible-pod.service -n 100 --no-pager
journalctl --user -u centsible-mariadb.service -n 100 --no-pager
journalctl --user -u centsible-api.service -n 100 --no-pager
journalctl --user -u centsible-web.service -n 100 --no-pager
podman logs --tail 100 centsible-mariadb
podman logs --tail 100 centsible-api
podman logs --tail 100 centsible-web

# Port bindings
podman port centsible-web
podman port centsible-api

# Database sanity check (uses the repo-local .env)
set -a
. "$(git rev-parse --show-toplevel)/.env"
set +a
podman exec centsible-mariadb mariadb -u "$MARIADB_USER" -p"$MARIADB_PASSWORD" -D "$MARIADB_DATABASE" -e 'SHOW TABLES;'
```

[↑ Go to TOC](#table-of-contents)

---

## Logs

```bash
# Tail all services together
./scripts/logs.sh

# Individual services
journalctl --user -u centsible-api.service -f
journalctl --user -u centsible-web.service -f
journalctl --user -u centsible-mariadb.service -f

# Last 100 lines
journalctl --user -u centsible-api.service -n 100
```

[↑ Go to TOC](#table-of-contents)

---

## Upgrading

To deploy a new version:

1. Pull / update the source code on the host.
2. Rebuild the images and restart the stack in one shot:
   ```bash
   ./scripts/rebuild.sh
   ```
   Or, if Quadlet files in `infra/quadlet/` changed, re-run the full install
   (it's idempotent and will re-stamp the env path):
   ```bash
   ./scripts/install.sh
   ```

The API entrypoint automatically runs `bun run src/db/migrate.ts` on every start, so database migrations are applied as part of the restart.

### Zero-downtime consideration

The current setup restarts the entire pod. For a personal/small-team deployment this is acceptable (seconds of downtime). For a zero-downtime upgrade, you would need a load-balanced setup that is outside the current scope.

[↑ Go to TOC](#table-of-contents)

---

## Rollback

Because images are built locally and tagged `centsible-api:latest` / `centsible-web:latest`, rollback requires keeping previous image versions.

Before upgrading, tag the current images:

```bash
podman tag centsible-api:latest centsible-api:prev
podman tag centsible-web:latest centsible-web:prev
```

To roll back:

```bash
# Restore previous images
podman tag centsible-api:prev centsible-api:latest
podman tag centsible-web:prev centsible-web:latest

# Restart
systemctl --user restart centsible-pod.service
```

> **Database rollbacks** are not automated. Migrations are append-only and designed to be backward-compatible. If a migration must be reversed, write a new corrective migration rather than running down scripts.

[↑ Go to TOC](#table-of-contents)

---

## Database Operations

### Run a migration manually

```bash
podman exec centsible-api bun run packages/api/src/db/migrate.ts
```

### Seed the database

```bash
./scripts/seed.sh
# or:
podman exec centsible-api bun run packages/api/src/db/seed.ts
```

### Access MariaDB shell

```bash
podman exec -it centsible-mariadb mariadb -u centsible -p centsible
```

### Backup the database

```bash
podman exec centsible-mariadb \
  mariadb-dump -u centsible -p<MARIADB_PASSWORD> centsible \
  > centsible-backup-$(date +%Y%m%d).sql
```

### Restore from backup

```bash
podman exec -i centsible-mariadb \
  mariadb -u centsible -p<MARIADB_PASSWORD> centsible \
  < centsible-backup-YYYYMMDD.sql
```

### Persistent data volume

MariaDB data is declared via the Quadlet volume unit `infra/quadlet/centsible-db.volume`, which provisions the named Podman volume `centsible-db`. That volume persists across container restarts, image rebuilds, and standard uninstall operations.

```bash
# Inspect volume location
podman volume inspect centsible-db

# List all volumes
podman volume ls
```

To remove database data entirely, run:

```bash
./scripts/teardown.sh --purge-volumes
```

[↑ Go to TOC](#table-of-contents)

---

## Networking

All four units share a single Podman pod (`PodName=centsible`). Within the pod, containers communicate over `localhost` — no custom DNS is needed.

External port mapping (from the pod definition):

| Host port | Pod port | Service |
|---|---|---|
| `0.0.0.0:10300` | `10300` | Web frontend |
| `0.0.0.0:10301` | `10301` | API backend |

MariaDB port `3306` is intentionally **not** mapped to the host.

### Reverse proxy (optional)

To serve Centsible over HTTPS on a standard port, place a reverse proxy (e.g. Caddy, nginx, Traefik) in front:

```
https://centsible.example.com  →  http://localhost:10300  (web)
https://api.centsible.example.com  →  http://localhost:10301  (api, if exposed separately)
```

Remember to update `WEB_URL` in `.env` and the `VITE_API_URL` build-arg to match the public URLs, then rebuild the web image.

[↑ Go to TOC](#table-of-contents)

---

## Troubleshooting

### API fails to start — "Database not reachable"

The entrypoint retries the TCP connection 30 times (2 s apart). If it still fails after 60 s:
- Check the MariaDB container is running: `systemctl --user status centsible-mariadb.service`
- Check logs: `journalctl --user -u centsible-mariadb.service -n 50`
- Confirm the `DB_PASSWORD` in `.env` matches `MARIADB_PASSWORD`

### "Missing required environment variable" on API startup

The API crashes fast if a required env var is absent in production. Check `.env` contains all required keys listed in [Environment Secrets](#environment-secrets).

### Web app shows a blank page / network errors

- Confirm `VITE_API_URL` was set correctly **at build time** (it is baked into the JS bundle).
- Rebuild the web image with the correct value: `./scripts/rebuild.sh`

### CORS errors in browser

`WEB_URL` in `.env` must exactly match the origin the browser uses (scheme + host + port). A mismatch causes CORS preflight failures. Update the value and restart the API container.

### Quadlet units not appearing in systemd

Run `systemctl --user daemon-reload` after copying files to `~/.config/containers/systemd/`. If units still don't appear, check for syntax errors with `systemd-analyze verify ~/.config/containers/systemd/centsible.pod`.

### Logs show "Too many requests"

The API rate-limiter uses in-memory state keyed by IP. Limits are:
- Auth endpoints: 10 requests / minute / IP
- All other endpoints: 100 requests / minute / IP

If you are behind a reverse proxy, ensure it sets `X-Forwarded-For` or `X-Real-IP` so the limiter sees the real client IP instead of `127.0.0.1` — **and** set `TRUST_PROXY_HEADERS=true` in `.env` so the API honours those headers. Leave `TRUST_PROXY_HEADERS=false` when the API is exposed directly: enabling it without a trusted proxy in front lets any client spoof their IP and bypass the limiter. The per-IP windows can be tuned with `RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, and `GENERAL_RATE_LIMIT_MAX`.

[↑ Go to TOC](#table-of-contents)

---

&copy; 2026 UncleJs — Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
