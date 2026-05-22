#!/usr/bin/env bash
# ── Centsible — Rebuild images & restart stack ───────────────
# Assumes the stack has already been installed via install.sh.
# Runs verify:image inside the existing dev container, stops the
# pod, rebuilds all three images, then starts the pod again.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

verify_before_build

stop_pod

build_dev_image
build_api_image
build_web_image
print_image_summary

start_pod
print_status
