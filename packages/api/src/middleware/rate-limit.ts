import { Elysia } from "elysia";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { config } from "../config";

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const CLEANUP_WINDOWS_TO_KEEP = 10;
let lastCleanupAt = 0;

function truncateIdentifier(value: string): string {
  return value.slice(0, 255);
}

function floorToWindow(nowMs: number, windowMs: number): Date {
  const floored = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(floored);
}

function getClientIdentifier(
  headers: Record<string, string | undefined>
): string {
  const forwarded = headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const realIp = headers["x-real-ip"]?.trim();
  const fallbackIp = headers["cf-connecting-ip"]?.trim();
  const ua = (headers["user-agent"] || "unknown").slice(0, 120);

  const trustedIp = config.trustProxyHeaders
    ? forwarded || realIp || fallbackIp
    : undefined;

  return truncateIdentifier(trustedIp ? `ip:${trustedIp}` : `ua:${ua}`);
}

async function archiveStaleWindows(nowMs: number): Promise<void> {
  if (nowMs - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = nowMs;

  const cutoff = new Date(nowMs - config.rateLimitWindowMs * CLEANUP_WINDOWS_TO_KEEP);
  await db
    .update(schema.rateLimitCounters)
    .set({ archivedAt: new Date() })
    .where(
      and(
        isNull(schema.rateLimitCounters.archivedAt),
        lt(schema.rateLimitCounters.windowStart, cutoff)
      )
    );
}

async function isRateLimited(
  scope: "auth" | "general",
  identifier: string,
  maxRequests: number
): Promise<boolean> {
  const nowMs = Date.now();
  const windowStart = floorToWindow(nowMs, config.rateLimitWindowMs);

  await db
    .insert(schema.rateLimitCounters)
    .values({
      scope,
      identifier,
      windowStart,
      requestCount: 1,
    })
    .onDuplicateKeyUpdate({
      set: {
        requestCount: sql`${schema.rateLimitCounters.requestCount} + 1`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
        archivedAt: null,
      },
    });

  const [counter] = await db
    .select({ requestCount: schema.rateLimitCounters.requestCount })
    .from(schema.rateLimitCounters)
    .where(
      and(
        eq(schema.rateLimitCounters.scope, scope),
        eq(schema.rateLimitCounters.identifier, identifier),
        eq(schema.rateLimitCounters.windowStart, windowStart),
        isNull(schema.rateLimitCounters.archivedAt)
      )
    )
    .limit(1);

  await archiveStaleWindows(nowMs);
  return (counter?.requestCount ?? 0) > maxRequests;
}

function makeRateLimitPlugin(
  name: string,
  scope: "auth" | "general",
  maxRequests: number,
  as: "local" | "scoped"
) {
  return new Elysia({ name }).derive({ as }, async ({ headers, set }) => {
    const identifier = getClientIdentifier(
      headers as Record<string, string | undefined>
    );

    if (await isRateLimited(scope, identifier, maxRequests)) {
      set.status = 429;
      set.headers["retry-after"] = String(
        Math.ceil(config.rateLimitWindowMs / 1000)
      );
      throw new Error("Too many requests. Please try again later.");
    }

    return {};
  });
}

export const authRateLimit = makeRateLimitPlugin(
  "auth-rate-limit",
  "auth",
  config.authRateLimitMax,
  "local"
);

export const generalRateLimit = makeRateLimitPlugin(
  "general-rate-limit",
  "general",
  config.generalRateLimitMax,
  "scoped"
);
