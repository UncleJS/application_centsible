// ── Centralized configuration ──
// Crashes on startup if required secrets are missing in production.

const isProduction = process.env.NODE_ENV === "production";

function requireEnv(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  console.warn(`⚠ ${name} not set — using dev default (unsafe for production)`);
  return devDefault;
}

export const config = {
  port: Number(process.env.API_PORT) || 4000,
  isProduction,

  // JWT — separate secrets for access and refresh tokens
  jwtSecret: requireEnv("JWT_SECRET", "centsible-dev-secret-change-in-production"),
  jwtRefreshSecret: requireEnv(
    "JWT_REFRESH_SECRET",
    "centsible-dev-refresh-secret-change-in-production"
  ),

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

  // Database
  dbHost: requireEnv("DB_HOST", "localhost"),
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbUser: requireEnv("DB_USER", "centsible"),
  dbPassword: requireEnv("DB_PASSWORD", "centsible_dev"),
  dbName: requireEnv("DB_NAME", "centsible"),
} as const;
