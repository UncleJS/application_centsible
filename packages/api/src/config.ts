// ── Centralized configuration ──
// Crashes on startup if required secrets are missing or unsafe.

import { EXCHANGE_RATE_API_BASE as EXCHANGE_RATE_API_BASE_DEFAULT } from "@centsible/shared";

const isProduction = process.env.NODE_ENV === "production";

const forbiddenSecretValues = new Set([
  "change-this-to-a-random-secret-in-production",
  "change-this-to-a-different-random-secret-in-production",
  "centsible-dev-secret-change-in-production",
  "centsible-dev-refresh-secret-change-in-production",
]);

function requireEnv(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  console.warn(`⚠ ${name} not set — using dev default (unsafe for production)`);
  return devDefault;
}

function requireSecretEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required secret environment variable: ${name}`);
  }

  if (forbiddenSecretValues.has(value)) {
    throw new Error(
      `Unsafe secret configured for ${name}. Replace the placeholder/example value before starting the API.`
    );
  }

  return value;
}

export const config = {
  port: Number(process.env.API_PORT) || 4000,
  isProduction,

  // JWT — separate secrets for access and refresh tokens
  jwtSecret: requireSecretEnv("JWT_SECRET"),
  jwtRefreshSecret: requireSecretEnv("JWT_REFRESH_SECRET"),

  // Token expiry
  accessTokenExp: "15m" as const,
  refreshTokenDays: 7,

  // Rate limits
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  generalRateLimitMax: Number(process.env.GENERAL_RATE_LIMIT_MAX) || 100,
  trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === "true",

  // CORS
  webUrl: process.env.WEB_URL || "http://localhost:3000",

  // Swagger /docs and /openapi.json gate. In production, requests must present
  // `Authorization: Bearer <DOCS_AUTH_TOKEN>` to read the schema. Leaving this
  // empty in production disables docs entirely (the API returns 503 to anyone
  // who hits /docs). In development, /docs is always open.
  docsAuthToken: process.env.DOCS_AUTH_TOKEN?.trim() || "",

  // Database
  dbHost: requireEnv("DB_HOST", "localhost"),
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbUser: requireEnv("DB_USER", "centsible"),
  dbPassword: requireEnv("DB_PASSWORD", "centsible_dev"),
  dbName: requireEnv("DB_NAME", "centsible"),

  // Exchange-rate upstream. Defaults to the shared Frankfurter base. Override
  // via env so E2E can point at an unreachable host and exercise the cached
  // fallback path without touching the public internet.
  exchangeRateApiBase:
    process.env.EXCHANGE_RATE_API_BASE?.trim() || EXCHANGE_RATE_API_BASE_DEFAULT,
} as const;
