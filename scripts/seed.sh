#!/usr/bin/env bash
# ── Centsible — Seed the database ────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

info "Running database seed..."
podman exec centsible-api bun run packages/api/src/db/seed.ts
info "Seed complete."
