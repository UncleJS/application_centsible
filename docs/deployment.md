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
      │     ├── centsible-mariadb      MariaDB 11.7  — port 3306 (pod-internal only)
      │     ├── centsible-api          Bun/Elysia    — port 10301 (exposed)
      │     └── centsible-web          Next.js       — port 10300 (exposed)
      │
      └── systemd volumes
            └── centsible-db           Persistent MariaDB data
```

All containers share `localhost` within the pod (slirp4netns networking). The API reaches MariaDB at `localhost:3306`. The web app reaches the API at `localhost:10301`. MariaDB is **never exposed** outside the pod.

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
  - Internet access (to pull `docker.io/library/mariadb:11.7` and build dependencies)
- Bun installed on the host (for building images from source; or pre-built images transferred in)
- The project source cloned to the host

Enable lingering so the user session starts at boot without an interactive login:

```bash
sudo loginctl enable-linger $USER
```

[↑ Go to TOC](#table-of-contents)

---

## First-Time Setup

The `infra/deploy.sh` script automates the full workflow:

```bash
# From the project root
./infra/deploy.sh
```

This runs three steps in sequence: **build → install → start**.

You can run each step independently:

```bash
./infra/deploy.sh build      # Build container images only
./infra/deploy.sh install    # Install Quadlet files + create .env if missing
./infra/deploy.sh start      # Start all services
```

[↑ Go to TOC](#table-of-contents)

---

## Building Container Images

Images are built locally — they are **not pushed to a registry**.

```bash
./infra/deploy.sh build
```

Under the hood this runs:

```bash
# API image
podman build \
  -t centsible-api:latest \
  -f infra/Containerfile.api \
  .

# Web image (NEXT_PUBLIC_API_URL is baked in at build time)
podman build \
  -t centsible-web:latest \
  -f infra/Containerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:10301 \
  .
```

### What the builds do

**`Containerfile.api`** (multi-stage):
1. Stage 1 (`build`): Installs all dependencies, bundles `src/index.ts` into a single `dist/index.js` with `bun build --target bun`.
2. Stage 2 (`migrate`): Minimal image that only runs database migrations (used by the entrypoint).
3. Stage 3 (`runtime`): Copies the bundle and migration files; runs as non-root user `centsible` (UID 1001).

**`Containerfile.web`** (multi-stage):
1. Stage 1: Installs all dependencies.
2. Stage 2: Runs `next build` which produces a standalone output under `.next/standalone`.
3. Stage 3: Copies only the standalone server, static files, and public directory; runs as non-root user `centsible`.

> **`NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time.** If you change the API port or host, you must rebuild the web image.

[↑ Go to TOC](#table-of-contents)

---

## Installing Quadlet Units

```bash
./infra/deploy.sh install
```

This copies the four files from `infra/quadlet/` to `~/.config/containers/systemd/`:

```
~/.config/containers/systemd/
├── centsible.pod
├── centsible-api.container
├── centsible-web.container
└── centsible-mariadb.container
```

Then runs `systemctl --user daemon-reload` so systemd discovers the new units.

> Quadlet reads these `.pod` and `.container` files and auto-generates the corresponding `.service` units — you never write `.service` files by hand.

[↑ Go to TOC](#table-of-contents)

---

## Environment Secrets

The install step checks for `~/.config/containers/systemd/.env.centsible`. If it doesn't exist, it copies the example file and **exits with an error**, requiring you to fill in real values before proceeding:

```bash
cp infra/.env.centsible.example ~/.config/containers/systemd/.env.centsible
chmod 600 ~/.config/containers/systemd/.env.centsible
$EDITOR ~/.config/containers/systemd/.env.centsible
```

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

> The file is loaded by both the `centsible-api.container` and `centsible-mariadb.container` units via `EnvironmentFile=%h/.config/containers/systemd/.env.centsible`. The `%h` expands to the home directory of the running user.

[↑ Go to TOC](#table-of-contents)

---

## Starting & Stopping Services

```bash
# Start everything (pod + all containers)
./infra/deploy.sh start
# or directly:
systemctl --user start centsible-pod.service

# Stop everything
./infra/deploy.sh stop
# or directly:
systemctl --user stop centsible-pod.service

# Restart a single service
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

[↑ Go to TOC](#table-of-contents)

---

## Verifying the Deployment

```bash
# Check all service statuses
systemctl --user status centsible-pod.service
systemctl --user status centsible-mariadb.service
systemctl --user status centsible-api.service
systemctl --user status centsible-web.service

# Health check the API
curl http://localhost:10301/health
# Expected: {"status":"ok","timestamp":"..."}

# Check the web app is responding
curl -I http://localhost:10300
# Expected: HTTP/1.1 200 OK
```

[↑ Go to TOC](#table-of-contents)

---

## Logs

```bash
# Tail all services together
./infra/deploy.sh logs

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
2. Rebuild the images:
   ```bash
   ./infra/deploy.sh build
   ```
3. Reload systemd units if any Quadlet files changed:
   ```bash
   ./infra/deploy.sh install
   ```
4. Restart the services:
   ```bash
   systemctl --user restart centsible-pod.service
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
./infra/deploy.sh seed
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

MariaDB data is stored in the named Podman volume `centsible-db`. This volume persists across container restarts and image rebuilds.

```bash
# Inspect volume location
podman volume inspect centsible-db

# List all volumes
podman volume ls
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

Remember to update `WEB_URL` in `.env.centsible` and `NEXT_PUBLIC_API_URL` build-arg to match the public URLs, then rebuild the web image.

[↑ Go to TOC](#table-of-contents)

---

## Troubleshooting

### API fails to start — "Database not reachable"

The entrypoint retries the TCP connection 30 times (2 s apart). If it still fails after 60 s:
- Check the MariaDB container is running: `systemctl --user status centsible-mariadb.service`
- Check logs: `journalctl --user -u centsible-mariadb.service -n 50`
- Confirm the `DB_PASSWORD` in `.env.centsible` matches `MARIADB_PASSWORD`

### "Missing required environment variable" on API startup

The API crashes fast if a required env var is absent in production. Check `.env.centsible` contains all required keys listed in [Environment Secrets](#environment-secrets).

### Web app shows a blank page / network errors

- Confirm `NEXT_PUBLIC_API_URL` was set correctly **at build time** (it is baked into the JS bundle).
- Rebuild the web image with the correct value: `./infra/deploy.sh build`

### CORS errors in browser

`WEB_URL` in `.env.centsible` must exactly match the origin the browser uses (scheme + host + port). A mismatch causes CORS preflight failures. Update the value and restart the API container.

### Quadlet units not appearing in systemd

Run `systemctl --user daemon-reload` after copying files to `~/.config/containers/systemd/`. If units still don't appear, check for syntax errors with `systemd-analyze verify ~/.config/containers/systemd/centsible.pod`.

### Logs show "Too many requests"

The API rate-limiter uses in-memory state keyed by IP. Limits are:
- Auth endpoints: 10 requests / minute / IP
- All other endpoints: 100 requests / minute / IP

If you are behind a reverse proxy, ensure it sets `X-Forwarded-For` or `X-Real-IP` so the limiter sees the real client IP instead of `127.0.0.1`.

[↑ Go to TOC](#table-of-contents)

---

&copy; 2026 UncleJs — Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
