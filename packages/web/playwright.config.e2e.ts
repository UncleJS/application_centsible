import { defineConfig, devices } from "@playwright/test";

// ── Centsible end-to-end test config ──────────────────────────────────────────
// Runs the real Vite-preview build of the web app against a real Elysia API on
// a dedicated port, backed by a dedicated `centsible_test` schema inside the
// existing MariaDB container. No mocks — every assertion is end-to-end.
//
// Run with: `podman exec centsible-dev bun run --filter @centsible/web test:e2e`

const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 3100;
const API_PORT = Number(process.env.E2E_API_PORT) || 4001;
const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

const apiEnv: Record<string, string> = {
  NODE_ENV: "development",
  API_PORT: String(API_PORT),
  WEB_URL: BASE_URL,
  DB_NAME: process.env.E2E_DB_NAME?.trim() || "centsible_test",
  // Test-only JWT secrets. Distinct from any forbidden placeholder values so
  // the production safety check in config.ts is satisfied.
  JWT_SECRET:
    process.env.E2E_JWT_SECRET ||
    "e2e-jwt-secret-must-not-collide-with-production-do-not-deploy",
  JWT_REFRESH_SECRET:
    process.env.E2E_JWT_REFRESH_SECRET ||
    "e2e-refresh-secret-must-not-collide-with-production-do-not-deploy",
  // Point Frankfurter at an unreachable host so the route exercises the
  // cached-rate fallback. global-setup.ts pre-seeds the cache.
  EXCHANGE_RATE_API_BASE: "http://127.0.0.1:1",
  // High limits so a tightly-clustered test run isn't rate-limited.
  RATE_LIMIT_WINDOW_MS: "60000",
  AUTH_RATE_LIMIT_MAX: "1000",
  GENERAL_RATE_LIMIT_MAX: "10000",
};

for (const key of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "MARIADB_ROOT_PASSWORD"]) {
  const value = process.env[key];
  if (value) apiEnv[key] = value;
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: "./tests/e2e/support/global-setup.ts",
  globalTeardown: "./tests/e2e/support/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun run src/index.ts",
      cwd: "../api",
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
      env: apiEnv,
    },
    {
      // Always rebuild so VITE_API_URL is baked into the bundle for this run.
      command: `sh -lc 'bun run build && bun run vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort'`,
      url: BASE_URL,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180_000,
      env: {
        VITE_API_URL: API_URL,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});

export { API_URL, BASE_URL, API_PORT, WEB_PORT };
