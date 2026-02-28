import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db, schema } from "../db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { hash, verify } from "argon2";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@centsible/shared";
import { config } from "../config";
import { authRateLimit } from "../middleware/rate-limit";

const REFRESH_TOKEN_QUERY_LIMIT = 10;

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
    async ({ body, jwt, refreshJwt, set }) => {
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
      const refreshToken = await refreshJwt.sign({ sub: String(userId) });

      // Store refresh token hash
      const tokenHash = await hash(refreshToken);
      await db.insert(schema.refreshTokens).values({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      });

      set.status = 201;
      return {
        data: {
          user: { id: userId, email, name, defaultCurrency: defaultCurrency ?? "GBP" },
          tokens: { accessToken, refreshToken },
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
    async ({ body, jwt, refreshJwt, set }) => {
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
      const refreshToken = await refreshJwt.sign({ sub: String(user.id) });

      const tokenHash = await hash(refreshToken);
      await db.insert(schema.refreshTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      });

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            defaultCurrency: user.defaultCurrency,
          },
          tokens: { accessToken, refreshToken },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email", error: "Invalid email address" }),
        password: t.String({ minLength: 1, error: "Password is required" }),
      }),
    }
  )
  // ── Refresh Token ──
  .post(
    "/refresh",
    async ({ body, jwt, refreshJwt, set }) => {
      const { refreshToken } = body;

      const payload = await refreshJwt.verify(refreshToken);
      if (!payload || typeof payload.sub !== "string") {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }

      const userId = Number(payload.sub);

      // Verify refresh token exists, is not revoked, and is not expired
      const storedTokens = await db
        .select()
        .from(schema.refreshTokens)
        .where(
          and(
            eq(schema.refreshTokens.userId, userId),
            isNull(schema.refreshTokens.revokedAt),
            gt(schema.refreshTokens.expiresAt, new Date())
          )
        )
        .limit(REFRESH_TOKEN_QUERY_LIMIT);

      let validToken = false;
      let matchedTokenId: number | null = null;

      for (const stored of storedTokens) {
        try {
          const matches = await verify(stored.tokenHash, refreshToken);
          if (matches) {
            validToken = true;
            matchedTokenId = stored.id;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!validToken || !matchedTokenId) {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }

      // Revoke old token
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.id, matchedTokenId));

      // Issue new tokens
      const newAccessToken = await jwt.sign({ sub: String(userId) });
      const newRefreshToken = await refreshJwt.sign({ sub: String(userId) });

      const newTokenHash = await hash(newRefreshToken);
      await db.insert(schema.refreshTokens).values({
        userId,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      });

      return {
        data: {
          tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken },
        },
      };
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
    }
  )
  // ── Logout ──
  .post(
    "/logout",
    async ({ body, refreshJwt }) => {
      // Best-effort revocation — always return success to avoid info leaks
      try {
        const { refreshToken } = body;
        if (!refreshToken) {
          return { data: { message: "Logged out successfully" } };
        }

        const payload = await refreshJwt.verify(refreshToken);
        if (!payload || typeof payload.sub !== "string") {
          return { data: { message: "Logged out successfully" } };
        }

        const userId = Number(payload.sub);

        // Find and revoke the matching token
        const storedTokens = await db
          .select()
          .from(schema.refreshTokens)
          .where(
            and(
              eq(schema.refreshTokens.userId, userId),
              isNull(schema.refreshTokens.revokedAt)
            )
          )
          .limit(REFRESH_TOKEN_QUERY_LIMIT);

        for (const stored of storedTokens) {
          try {
            const matches = await verify(stored.tokenHash, refreshToken);
            if (matches) {
              await db
                .update(schema.refreshTokens)
                .set({ revokedAt: new Date() })
                .where(eq(schema.refreshTokens.id, stored.id));
              break;
            }
          } catch {
            continue;
          }
        }
      } catch {
        // Swallow errors — logout should always succeed from the client's perspective
      }

      return { data: { message: "Logged out successfully" } };
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
    }
  );
