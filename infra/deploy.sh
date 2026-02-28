#!/usr/bin/env bash
# ── Centsible — Build & Deploy ───────────────────────────────
# Builds container images and installs Quadlet units for
# rootless Podman + systemd.
#
# Usage:
#   ./infra/deploy.sh              # build + install + start
#   ./infra/deploy.sh build        # only build images
#   ./infra/deploy.sh install      # only install Quadlet files
#   ./infra/deploy.sh start        # only start services
#   ./infra/deploy.sh stop         # stop all services
#   ./infra/deploy.sh logs         # tail all logs
#   ./infra/deploy.sh seed         # run database seed
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
QUADLET_DIR="${HOME}/.config/containers/systemd"
ENV_FILE="${QUADLET_DIR}/.env.centsible"

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}▸${NC} $*"; }
warn()  { echo -e "${YELLOW}▸${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }

# ── Build images ─────────────────────────────────────────────
build() {
  info "Building centsible-api image..."
  podman build \
    -t centsible-api:latest \
    -f "$SCRIPT_DIR/Containerfile.api" \
    "$PROJECT_ROOT"

  info "Building centsible-web image..."
  podman build \
    -t centsible-web:latest \
    -f "$SCRIPT_DIR/Containerfile.web" \
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:10301 \
    "$PROJECT_ROOT"

  info "Images built successfully."
  podman images --filter "reference=centsible-*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.Created}}"
}

# ── Install Quadlet files ────────────────────────────────────
install_quadlet() {
  mkdir -p "$QUADLET_DIR"

  # Copy Quadlet files
  for f in "$SCRIPT_DIR/quadlet/"*; do
    cp -v "$f" "$QUADLET_DIR/"
  done

  # Check .env file
  if [ ! -f "$ENV_FILE" ]; then
    warn ".env file not found at $ENV_FILE"
    warn "Copying example — EDIT BEFORE STARTING!"
    cp "$SCRIPT_DIR/.env.centsible.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    error "Edit $ENV_FILE with real passwords, then re-run: $0 start"
    return 1
  fi

  # Reload systemd to pick up new Quadlet files
  systemctl --user daemon-reload
  info "Quadlet files installed and systemd reloaded."
}

# ── Start services ───────────────────────────────────────────
start() {
  info "Starting Centsible pod..."
  systemctl --user start centsible-pod.service

  info "Waiting for services..."
  sleep 3

  systemctl --user status centsible-pod.service --no-pager || true
  systemctl --user status centsible-mariadb.service --no-pager || true
  systemctl --user status centsible-api.service --no-pager || true
  systemctl --user status centsible-web.service --no-pager || true

  info "Centsible is running:"
  info "  Web:     http://localhost:10300"
  info "  API:     http://localhost:10301"
  info "  Swagger: http://localhost:10301/docs"
}

# ── Stop services ────────────────────────────────────────────
stop() {
  info "Stopping Centsible pod..."
  systemctl --user stop centsible-pod.service || true
  info "Stopped."
}

# ── Tail logs ────────────────────────────────────────────────
logs() {
  journalctl --user -u centsible-api.service -u centsible-web.service -u centsible-mariadb.service -f
}

# ── Seed database ────────────────────────────────────────────
seed() {
  info "Running database seed..."
  podman exec centsible-api bun run packages/api/src/db/seed.ts
  info "Seed complete."
}

# ── Main ─────────────────────────────────────────────────────
case "${1:-all}" in
  build)   build ;;
  install) install_quadlet ;;
  start)   start ;;
  stop)    stop ;;
  logs)    logs ;;
  seed)    seed ;;
  all)
    build
    install_quadlet && start
    ;;
  *)
    error "Unknown command: $1"
    echo "Usage: $0 {build|install|start|stop|logs|seed|all}"
    exit 1
    ;;
esac
