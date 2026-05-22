import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { generalRateLimit } from "./middleware/rate-limit";
import { authRoutes } from "./routes/auth";
import { categoryRoutes } from "./routes/categories";
import { transactionRoutes } from "./routes/transactions";
import { budgetRoutes } from "./routes/budgets";
import { savingsGoalRoutes } from "./routes/savings-goals";
import { subscriptionRoutes } from "./routes/subscriptions";
import { recurringIncomeRoutes } from "./routes/recurring-income";
import { reportRoutes } from "./routes/reports";
import { exchangeRateRoutes } from "./routes/exchange-rates";

const requestContext = new Elysia({ name: "request-context" }).derive(
  { as: "global" },
  ({ set }) => {
    const requestId = crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
    return { requestId, requestStartMs: Date.now() };
  }
);

const app = new Elysia()
  .use(requestContext)
  .use(
    cors({
      origin: config.webUrl,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    })
  )
  .use(generalRateLimit)
  .onAfterHandle(({ request, set, requestId, requestStartMs }) => {
    const status =
      typeof set.status === "number"
        ? set.status
        : Number(set.status || 200);

    console.log(
      JSON.stringify({
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        durationMs: Date.now() - requestStartMs,
        timestamp: new Date().toISOString(),
      })
    );
  })
  // Global error handler — catch unexpected errors
  .onError(({ code, error, set, requestId }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: String(error), requestId };
    }
    // Don't leak internal details in production
    const msg = error instanceof Error ? error.message : String(error);
    if (config.isProduction) {
      console.error("Unhandled error:", JSON.stringify({ requestId, message: msg }));
      set.status = 500;
      return { error: "Internal server error", requestId };
    }
    // In dev, return the full error
    set.status = 500;
    return { error: msg || "Internal server error", requestId };
  });

// ── Swagger /docs gate ──
// In production, the docs are auth-protected by a static bearer token. The
// schema is still useful for ops and the frontend codegen — but it's not for
// anonymous reconnaissance.
function isDocsPath(pathname: string): boolean {
  return pathname === "/openapi.json" || pathname === "/docs" || pathname.startsWith("/docs/");
}

function bearerTokensMatch(presented: string, expected: string): boolean {
  // Length check up front avoids leaking length via timing — timingSafeEqual
  // throws if the buffers differ in length.
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

app.onBeforeHandle(({ request, set, headers }) => {
  const pathname = new URL(request.url).pathname;
  if (!isDocsPath(pathname)) return;
  if (!config.isProduction) return;

  if (!config.docsAuthToken) {
    set.status = 503;
    return {
      error: "Swagger docs are disabled. Set DOCS_AUTH_TOKEN to enable.",
    };
  }

  const auth = headers.authorization ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!presented || !bearerTokensMatch(presented, config.docsAuthToken)) {
    set.status = 401;
    set.headers["www-authenticate"] = 'Bearer realm="centsible-docs"';
    return { error: "Unauthorized" };
  }
});

app.use(
  swagger({
    path: "/docs",
    documentation: {
      info: {
        title: "Centsible API",
        version: "0.1.0",
        description: "Budget tracker API — manage transactions, budgets, subscriptions, savings goals, and forecasts.",
      },
      tags: [
        { name: "Auth", description: "Authentication endpoints" },
        { name: "Categories", description: "Transaction categories" },
        { name: "Transactions", description: "Income and expense records" },
        { name: "Budgets", description: "Monthly budget limits" },
        { name: "Savings Goals", description: "Savings targets" },
        { name: "Subscriptions", description: "Recurring subscriptions" },
        { name: "Recurring Income", description: "Recurring income sources" },
        { name: "Reports", description: "Reporting and forecasts" },
        { name: "Exchange Rates", description: "Currency exchange rates" },
      ],
    },
  })
);

app.get("/openapi.json", ({ set }) => {
  set.redirect = "/docs/json";
});

app
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
  .get("/health", async ({ set }) => {
    // Verify the DB pool can actually serve a query — Quadlet's HealthCmd
    // hits this endpoint, so a stale or stuck DB connection trips the
    // restart loop instead of looking healthy forever.
    try {
      await db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        db: "ok",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      set.status = 503;
      return {
        status: "error",
        db: "unreachable",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  })
  .use(authRoutes)
  .use(categoryRoutes)
  .use(transactionRoutes)
  .use(budgetRoutes)
  .use(savingsGoalRoutes)
  .use(subscriptionRoutes)
  .use(recurringIncomeRoutes)
  .use(reportRoutes)
  .use(exchangeRateRoutes)
  .listen({
    hostname: "0.0.0.0",
    port: config.port,
  });

console.log(`Centsible API running on http://localhost:${config.port}`);
console.log(`Swagger docs at http://localhost:${config.port}/docs`);

export type App = typeof app;
