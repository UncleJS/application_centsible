#!/bin/sh
set -e

# ── Wait for database to be ready ──
# MariaDB may not accept connections immediately after container start.
# Poll with a simple TCP check (bun is available; no extra tools needed).
if [ -n "$DB_HOST" ]; then
  DB_PORT="${DB_PORT:-3306}"
  MAX_RETRIES=30
  RETRY_INTERVAL=2
  echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."

  retries=0
  until bun -e "
    const s = Bun.connect({ hostname: '${DB_HOST}', port: ${DB_PORT}, socket: {
      open(s) { s.end(); process.exit(0); },
      data() {},
      error() { process.exit(1); },
      close() {}
    }});
    setTimeout(() => process.exit(1), 3000);
  " 2>/dev/null; do
    retries=$((retries + 1))
    if [ "$retries" -ge "$MAX_RETRIES" ]; then
      echo "ERROR: Database not reachable after $((MAX_RETRIES * RETRY_INTERVAL))s — aborting."
      exit 1
    fi
    echo "  DB not ready (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
  done

  echo "Database is reachable."

  # Run migrations
  echo "Running database migrations..."
  cd /app/packages/api
  bun run src/db/migrate.ts
  cd /app
  echo "Migrations complete."
fi

# Execute the main command
exec "$@"
