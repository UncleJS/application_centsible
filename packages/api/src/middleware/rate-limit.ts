import { Elysia } from "elysia";

// ── In-memory sliding-window rate limiter ──
// Keyed by IP address. Separate limits for auth vs general routes.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(headers: Record<string, string | undefined>): string {
  // Trust X-Forwarded-For first header (from reverse proxy)
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headers["x-real-ip"];
  if (realIp) return realIp;
  return "unknown";
}

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return true;
  }

  entry.timestamps.push(now);
  return false;
}

/**
 * Rate limiting middleware for auth endpoints.
 * 10 requests per minute per IP.
 */
export const authRateLimit = new Elysia({ name: "auth-rate-limit" }).derive(
  { as: "local" },
  ({ headers, set }) => {
    const ip = getClientIp(headers as Record<string, string | undefined>);
    const key = `auth:${ip}`;

    if (isRateLimited(key, 10, 60_000)) {
      set.status = 429;
      throw new Error("Too many requests. Please try again later.");
    }

    return {};
  }
);

/**
 * Rate limiting middleware for general API endpoints.
 * 100 requests per minute per IP.
 */
export const generalRateLimit = new Elysia({ name: "general-rate-limit" }).derive(
  { as: "scoped" },
  ({ headers, set }) => {
    const ip = getClientIp(headers as Record<string, string | undefined>);
    const key = `general:${ip}`;

    if (isRateLimited(key, 100, 60_000)) {
      set.status = 429;
      throw new Error("Too many requests. Please try again later.");
    }

    return {};
  }
);
