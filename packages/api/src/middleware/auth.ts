import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db, schema } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { config } from "../config";

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
  .derive({ as: "global" }, async ({ jwt, headers, set }) => {
    const authorization = headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("Unauthorized: Missing or invalid token");
    }

    const token = authorization.slice(7);
    const payload = await jwt.verify(token);

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
