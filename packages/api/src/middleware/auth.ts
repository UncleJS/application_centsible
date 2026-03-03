import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db, schema } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { config } from "../config";
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
} from "../auth/session";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  defaultCurrency: string;
};

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(
    jwt({
      name: "jwt",
      secret: config.jwtSecret,
      exp: config.accessTokenExp,
    })
  )
  .derive({ as: "global" }, async ({ jwt, headers, set, cookie, request }) => {
    const authorization = headers.authorization;
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    const cookieToken = String(
      (cookie as Record<string, any>)[ACCESS_TOKEN_COOKIE]?.value ?? ""
    );
    const accessToken = bearerToken || cookieToken;

    if (!accessToken) {
      set.status = 401;
      throw new Error("Unauthorized: Missing or invalid token");
    }

    const method = request.method.toUpperCase();
    const requiresCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

    if (requiresCsrf && !bearerToken) {
      const csrfHeader = headers["x-csrf-token"];
      const csrfCookie = String(
        (cookie as Record<string, any>)[CSRF_TOKEN_COOKIE]?.value ?? ""
      );

      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        set.status = 403;
        throw new Error("Forbidden: Invalid CSRF token");
      }
    }

    const payload = await jwt.verify(accessToken);

    if (!payload || typeof payload.sub !== "string") {
      set.status = 401;
      throw new Error("Unauthorized: Invalid token");
    }

    const userId = Number(payload.sub);
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        defaultCurrency: schema.users.defaultCurrency,
      })
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), isNull(schema.users.archivedAt)))
      .limit(1);

    if (!user) {
      set.status = 401;
      throw new Error("Unauthorized: User not found");
    }

    return { user: user as AuthUser };
  });
