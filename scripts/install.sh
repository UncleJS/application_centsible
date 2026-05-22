#!/usr/bin/env bash
# ── Centsible — Full bootstrap ───────────────────────────────
# Stamps .env, builds all three images (dev → api → web),
# installs the Quadlet units, and starts the pod.
#
# Safe to re-run on an already-installed host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

stamp_env_file

# Bootstrap step: the dev image is built first and without verify:image,
# because verify:image runs inside the dev container which doesn't exist yet
# on a clean host.
build_dev_image
build_api_image
build_web_image
print_image_summary

install_quadlet_units

start_pod
print_status
