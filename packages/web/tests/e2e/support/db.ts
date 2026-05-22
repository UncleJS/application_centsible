// Lightweight wrapper around the API package's test-setup script. We shell out
// rather than import because the web package does not depend on `mysql2`, and
// Playwright's Node loader will not resolve workspace siblings.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, "..", "..", "..", "..", "api");

export function testDbName(): string {
  return process.env.E2E_DB_NAME?.trim() || "centsible_test";
}

function runScript(command: "bootstrap" | "truncate" | "drop"): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "bun",
      ["run", "src/db/test-setup.ts", command],
      {
        cwd: apiDir,
        env: { ...process.env },
        stdio: "inherit",
      }
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`test-setup ${command} exited with code ${code}`));
    });
  });
}

export async function bootstrap(): Promise<void> {
  await runScript("bootstrap");
}

export async function truncate(): Promise<void> {
  await runScript("truncate");
}

export async function dropTestDatabase(): Promise<void> {
  await runScript("drop");
}
