#!/usr/bin/env bash
# ── Centsible — Run the end-to-end suite ─────────────────────
# Runs the Playwright E2E suite inside the centsible-dev container against the
# pod's MariaDB, using a dedicated `centsible_test` schema (the dev `centsible`
# schema is never touched).
#
# Why this wrapper exists: the dev container's Quadlet unit has no
# `EnvironmentFile=`, so `podman exec` does not inherit the DB credentials. We
# source the repo-local .env here and forward the needed vars explicitly. We
# also pre-bootstrap the test schema first, because Playwright starts its API
# webServer (whose /health check connects to `centsible_test`) before
# globalSetup runs — without the schema in place, /health never goes green.
#
# Usage:
#   scripts/e2e.sh                       # run the whole suite
#   scripts/e2e.sh tests/e2e/auth.spec.ts   # extra args pass through to Playwright
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

DEV_CONTAINER="centsible-dev"

# ── Preconditions ────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  error "Repo-local .env not found at $ENV_FILE — run scripts/install.sh first."
  exit 1
fi

if ! podman container exists "$DEV_CONTAINER"; then
  error "Dev container '$DEV_CONTAINER' is not running. Run scripts/install.sh first."
  exit 1
fi

# ── Load DB credentials from the repo-local .env ─────────────
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "${MARIADB_ROOT_PASSWORD:-}" ]; then
  error "MARIADB_ROOT_PASSWORD is not set in $ENV_FILE — required to create the test schema."
  exit 1
fi

# Forwarded into the dev container. `-e NAME` (no value) passes the value from
# this script's environment, which we populated by sourcing .env above.
ENV_ARGS=(
  -e DB_HOST -e DB_PORT -e DB_USER -e DB_PASSWORD -e MARIADB_ROOT_PASSWORD
)
# Optional overrides — only forwarded when set in the environment.
for opt in E2E_DB_NAME E2E_WEB_PORT E2E_API_PORT E2E_JWT_SECRET E2E_JWT_REFRESH_SECRET; do
  if [ -n "${!opt:-}" ]; then
    ENV_ARGS+=(-e "$opt")
  fi
done

# ── Pre-bootstrap the test schema, then run the suite ────────
info "Bootstrapping E2E test schema inside $DEV_CONTAINER..."
podman exec "${ENV_ARGS[@]}" -w /workspace/packages/api \
  "$DEV_CONTAINER" bun run src/db/test-setup.ts bootstrap

info "Running the E2E suite..."
podman exec "${ENV_ARGS[@]}" \
  "$DEV_CONTAINER" bun run --filter @centsible/web test:e2e "$@"

info "E2E suite complete."
