#!/usr/bin/env bash
# ── Centsible — Stop the pod ─────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

stop_pod
info "Stopped."
