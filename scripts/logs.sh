#!/usr/bin/env bash
# ── Centsible — Tail all service logs ────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

exec journalctl --user \
  -u centsible-api.service \
  -u centsible-web.service \
  -u centsible-mariadb.service \
  -u centsible-dev.service \
  -f
