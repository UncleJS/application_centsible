import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command:
      "sh -lc 'test -f .next/standalone/packages/web/server.js || env -u NODE_ENV bun run build; mkdir -p .next/standalone/packages/web/.next; ln -sfn /workspace/packages/web/.next/static .next/standalone/packages/web/.next/static; if [ -d /workspace/packages/web/public ]; then ln -sfn /workspace/packages/web/public .next/standalone/packages/web/public; fi; cd .next/standalone/packages/web && HOSTNAME=127.0.0.1 PORT=3000 node server.js'",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
