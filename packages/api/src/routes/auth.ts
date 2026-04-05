import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db, schema } from "../db";
import { eq, and, isNull, lte } from "drizzle-orm";
import { SUPPORTED_CURRENCIES } from "@centsible/shared";
import { hash, verify } from "argon2";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@centsible/shared";
import { config } from "../config";
import { authRateLimit } from "../middleware/rate-limit";
import { authMiddleware } from "../middleware/auth";
import {
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  generateCsrfToken,
  setSessionCookies,
} from "../auth/session";

type RefreshTokenPayload = {
  sub: string;
  jti: string;
  fid: string;
};

function generateTokenId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function parseRefreshPayload(payload: unknown): RefreshTokenPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Record<string, unknown>;
  if (
    typeof parsed.sub !== "string" ||
    typeof parsed.jti !== "string" ||
    typeof parsed.fid !== "string"
  ) {
    return null;
  }
  return {
    sub: parsed.sub,
    jti: parsed.jti,
    fid: parsed.fid,
  };
}

async function archiveStaleRefreshTokens(userId: number): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date(), revokedReason: "expired" })
    .where(
      and(
        eq(schema.refreshTokens.userId, userId),
        isNull(schema.refreshTokens.revokedAt),
        lte(schema.refreshTokens.expiresAt, new Date())
      )
    );
}

async function revokeTokenFamily(
  userId: number,
  familyId: string,
  reason: "replay-detected" | "logout" | "compromised"
): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(
      and(
        eq(schema.refreshTokens.userId, userId),
        eq(schema.refreshTokens.familyId, familyId),
        isNull(schema.refreshTokens.revokedAt)
      )
    );
}

export const authRoutes = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  .use(authRateLimit)
  .use(
    jwt({
      name: "jwt",
      secret: config.jwtSecret,
      exp: config.accessTokenExp,
    })
  )
  .use(
    jwt({
      name: "refreshJwt",
      secret: config.jwtRefreshSecret,
      exp: "7d",
    })
  )
  // ── Register ──
  .post(
    "/register",
    async ({ body, jwt, refreshJwt, set, cookie }) => {
      const { email, password, name, defaultCurrency } = body;

      // Check if email already exists
      const [existing] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existing) {
        // Generic message to prevent email enumeration
        set.status = 409;
        return { error: "Unable to create account. Please try a different email or log in." };
      }

      const passwordHash = await hash(password);

      const [result] = await db.insert(schema.users).values({
        email,
        passwordHash,
        name,
        defaultCurrency: defaultCurrency ?? "GBP",
      }).$returningId();

      const userId = result.id;

      // Create default categories for the new user
      const allCategories = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
          userId,
          name: c.name,
          icon: c.icon,
          color: c.color,
          type: "expense" as const,
        })),
        ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
          userId,
          name: c.name,
          icon: c.icon,
          color: c.color,
          type: "income" as const,
        })),
      ];

      await db.insert(schema.categories).values(allCategories);

      // Generate tokens
      const accessToken = await jwt.sign({ sub: String(userId) });
      const tokenId = generateTokenId();
      const familyId = generateTokenId();
      const refreshToken = await refreshJwt.sign({
        sub: String(userId),
        jti: tokenId,
        fid: familyId,
      });

      // Store refresh token hash
      const tokenHash = await hash(refreshToken);
      await db.insert(schema.refreshTokens).values({
        userId,
        tokenId,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      });

      const csrfToken = generateCsrfToken();
      setSessionCookies(cookie as Record<string, any>, accessToken, refreshToken, csrfToken);

      set.status = 201;
      return {
        data: {
          user: { id: userId, email, name, defaultCurrency: defaultCurrency ?? "GBP" },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email", error: "Invalid email address" }),
        password: t.String({
          minLength: 8,
          maxLength: 128,
          error: "Password must be between 8 and 128 characters",
        }),
        name: t.String({ minLength: 1, maxLength: 100, error: "Name is required" }),
        defaultCurrency: t.Optional(
          t.String({ minLength: 3, maxLength: 3, error: "Currency must be a 3-letter ISO code" })
        ),
      }),
    }
  )
  // ── Login ──
  .post(
    "/login",
    async ({ body, jwt, refreshJwt, set, cookie }) => {
      const { email, password } = body;

      const [user] = await db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.email, email), isNull(schema.users.archivedAt)))
        .limit(1);

      if (!user) {
        set.status = 401;
        return { error: "Invalid email or password" };
      }

      const valid = await verify(user.passwordHash, password);
      if (!valid) {
        set.status = 401;
        return { error: "Invalid email or password" };
      }

      const accessToken = await jwt.sign({ sub: String(user.id) });
      const tokenId = generateTokenId();
      const familyId = generateTokenId();
      const refreshToken = await refreshJwt.sign({
        sub: String(user.id),
        jti: tokenId,
        fid: familyId,
      });

      const tokenHash = await hash(refreshToken);
      await archiveStaleRefreshTokens(user.id);
      await db.insert(schema.refreshTokens).values({
        userId: user.id,
        tokenId,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      });

      const csrfToken = generateCsrfToken();
      setSessionCookies(cookie as Record<string, any>, accessToken, refreshToken, csrfToken);

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            defaultCurrency: user.defaultCurrency,
          },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email", error: "Invalid email address" }),
        password: t.String({ minLength: 8, maxLength: 128, error: "Invalid password" }),
      }),
    }
  )
  // ── Refresh Token ──
  .post(
    "/refresh",
    async ({ body, jwt, refreshJwt, set, cookie }) => {
      const refreshTokenFromBody = body.refreshToken;
      const refreshTokenFromCookie = String(
        (cookie as Record<string, any>)[REFRESH_TOKEN_COOKIE]?.value ?? ""
      );
      const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;

      if (!refreshToken) {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }

      const payload = parseRefreshPayload(await refreshJwt.verify(refreshToken));
      if (!payload) {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }

      const userId = Number(payload.sub);
      if (Number.isNaN(userId) || userId <= 0) {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }

      await archiveStaleRefreshTokens(userId);

      const [stored] = await db
        .select()
        .from(schema.refreshTokens)
        .where(
          and(
            eq(schema.refreshTokens.userId, userId),
            eq(schema.refreshTokens.tokenId, payload.jti)
          )
        )
        .limit(1);

      if (!stored) {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }

      let hashMatches = false;
      try {
        hashMatches = await verify(stored.tokenHash, refreshToken);
      } catch {
        hashMatches = false;
      }

      if (!hashMatches) {
        await revokeTokenFamily(userId, payload.fid, "replay-detected");
        clearSessionCookies(cookie as Record<string, any>);
        set.status = 401;
        return { error: "Refresh token replay detected. Please sign in again." };
      }

      if (stored.revokedAt || stored.expiresAt <= new Date()) {
        await revokeTokenFamily(userId, payload.fid, "replay-detected");
        clearSessionCookies(cookie as Record<string, any>);
        set.status = 401;
        return { error: "Session revoked. Please sign in again." };
      }

      const rotation = await db.transaction(async (tx) => {
        const [active] = await tx
          .select({
            id: schema.refreshTokens.id,
            revokedAt: schema.refreshTokens.revokedAt,
            expiresAt: schema.refreshTokens.expiresAt,
          })
          .from(schema.refreshTokens)
          .where(
            and(
              eq(schema.refreshTokens.id, stored.id),
              eq(schema.refreshTokens.userId, userId),
              eq(schema.refreshTokens.familyId, payload.fid)
            )
          )
          .limit(1);

        if (!active || active.revokedAt || active.expiresAt <= new Date()) {
          return { ok: false as const };
        }

        await tx
          .update(schema.refreshTokens)
          .set({ revokedAt: new Date(), revokedReason: "rotated" })
          .where(eq(schema.refreshTokens.id, stored.id));

        const newTokenId = generateTokenId();
        const newRefreshToken = await refreshJwt.sign({
          sub: String(userId),
          jti: newTokenId,
          fid: payload.fid,
        });
        const newTokenHash = await hash(newRefreshToken);

        await tx.insert(schema.refreshTokens).values({
          userId,
          tokenId: newTokenId,
          familyId: payload.fid,
          tokenHash: newTokenHash,
          expiresAt: new Date(
            Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000
          ),
        });

        return { ok: true as const, newRefreshToken };
      });

      if (!rotation.ok) {
        await revokeTokenFamily(userId, payload.fid, "replay-detected");
        clearSessionCookies(cookie as Record<string, any>);
        set.status = 401;
        return { error: "Session revoked. Please sign in again." };
      }

      const newAccessToken = await jwt.sign({ sub: String(userId) });
      const newRefreshToken = rotation.newRefreshToken;

      const csrfToken = generateCsrfToken();
      setSessionCookies(
        cookie as Record<string, any>,
        newAccessToken,
        newRefreshToken,
        csrfToken
      );

      return {
        data: {
          ok: true,
        },
      };
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
    }
  )
  // ── Logout ──
  .post(
    "/logout",
    async ({ body, refreshJwt, headers, set, cookie }) => {
      const cookieJar = cookie as Record<string, any>;
      const cookieRefreshToken = String(cookieJar[REFRESH_TOKEN_COOKIE]?.value ?? "");
      const csrfCookie = String(cookieJar[CSRF_TOKEN_COOKIE]?.value ?? "");
      const csrfHeader = headers["x-csrf-token"];

      if (cookieRefreshToken && (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader)) {
        set.status = 403;
        return { error: "Invalid CSRF token" };
      }

      // Best-effort revocation — always return success to avoid info leaks
      try {
        const refreshToken = body.refreshToken || cookieRefreshToken;
        if (!refreshToken) {
          clearSessionCookies(cookieJar);
          return { data: { message: "Logged out successfully" } };
        }

        const payload = parseRefreshPayload(await refreshJwt.verify(refreshToken));
        if (!payload) {
          return { data: { message: "Logged out successfully" } };
        }

        const userId = Number(payload.sub);
        if (Number.isNaN(userId) || userId <= 0) {
          return { data: { message: "Logged out successfully" } };
        }

        await archiveStaleRefreshTokens(userId);

        const [stored] = await db
          .select()
          .from(schema.refreshTokens)
          .where(
            and(
              eq(schema.refreshTokens.userId, userId),
              eq(schema.refreshTokens.tokenId, payload.jti)
            )
          )
          .limit(1);

        if (stored) {
          let hashMatches = false;
          try {
            hashMatches = await verify(stored.tokenHash, refreshToken);
          } catch {
            hashMatches = false;
          }

          if (!hashMatches) {
            await revokeTokenFamily(userId, payload.fid, "replay-detected");
          } else {
            await db
              .update(schema.refreshTokens)
              .set({ revokedAt: new Date(), revokedReason: "logout" })
              .where(
                and(
                  eq(schema.refreshTokens.id, stored.id),
                  isNull(schema.refreshTokens.revokedAt)
                )
              );
          }
        }
      } catch {
        // Swallow errors — logout should always succeed from the client's perspective
      }

      clearSessionCookies(cookieJar);

      return { data: { message: "Logged out successfully" } };
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
    }
  )
  .use(authMiddleware)
  .get("/me", ({ user }) => {
    return { data: { user } };
  })
  // ── Update profile ──
  .patch(
    "/me",
    async ({ user, body, set }) => {
      const { name, defaultCurrency } = body;

      if (defaultCurrency !== undefined && !(SUPPORTED_CURRENCIES as readonly string[]).includes(defaultCurrency)) {
        set.status = 400;
        return { error: "Unsupported currency code" };
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (defaultCurrency !== undefined) updates.defaultCurrency = defaultCurrency;

      if (Object.keys(updates).length === 0) {
        set.status = 400;
        return { error: "No fields to update" };
      }

      await db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, user.id));

      const [updated] = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          defaultCurrency: schema.users.defaultCurrency,
        })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      return { data: { user: updated } };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100, error: "Name must be 1–100 characters" })),
        defaultCurrency: t.Optional(t.String({ minLength: 3, maxLength: 3, error: "Currency must be a 3-letter ISO code" })),
      }),
    }
  );
