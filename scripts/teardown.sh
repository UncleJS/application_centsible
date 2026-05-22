#!/usr/bin/env bash
# ── Centsible — Complete teardown ────────────────────────────
# Stops & disables units, removes the pod + containers, removes
# Quadlet files, then optionally removes images and/or named
# volumes.
#
# Usage:
#   ./scripts/teardown.sh                       # preserves images and volume data
#   ./scripts/teardown.sh --remove-images       # also drops built images
#   ./scripts/teardown.sh --purge-volumes       # also drops named volumes (DATA LOSS)
#   ./scripts/teardown.sh --remove-images --purge-volumes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

REMOVE_IMAGES=false
PURGE_VOLUMES=false

for arg in "$@"; do
  case "$arg" in
    --remove-images) REMOVE_IMAGES=true ;;
    --purge-volumes) PURGE_VOLUMES=true ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--remove-images] [--purge-volumes]

  --remove-images   Also delete locally built Centsible images
  --purge-volumes   Also delete named Podman volumes (DATA LOSS)
EOF
      exit 0
      ;;
    *)
      error "Unknown flag: $arg"
      echo "Usage: $0 [--remove-images] [--purge-volumes]" >&2
      exit 1
      ;;
  esac
done

stop_units
disable_units
remove_runtime
remove_quadlet_files
systemctl --user daemon-reload

if [ "$REMOVE_IMAGES" = true ]; then
  remove_images
fi

if [ "$PURGE_VOLUMES" = true ]; then
  purge_named_volumes
fi

info "Centsible teardown complete."
if [ "$PURGE_VOLUMES" != true ]; then
  warn "Named volume data was preserved. Re-run with --purge-volumes to remove it."
fi
if [ "$REMOVE_IMAGES" != true ]; then
  warn "Built images were preserved. Re-run with --remove-images to remove them."
fi
