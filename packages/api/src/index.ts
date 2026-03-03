import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
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

const app = new Elysia()
  .use(
    cors({
      origin: config.webUrl,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    })
  )
  .use(generalRateLimit)
  // Global error handler — catch unexpected errors
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: String(error) };
    }
    // Don't leak internal details in production
    const msg = error instanceof Error ? error.message : String(error);
    if (config.isProduction) {
      console.error("Unhandled error:", msg);
      set.status = 500;
      return { error: "Internal server error" };
    }
    // In dev, return the full error
    set.status = 500;
    return { error: msg || "Internal server error" };
  });

// Swagger docs — only in non-production environments
if (!config.isProduction) {
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
}

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
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(categoryRoutes)
  .use(transactionRoutes)
  .use(budgetRoutes)
  .use(savingsGoalRoutes)
  .use(subscriptionRoutes)
  .use(recurringIncomeRoutes)
  .use(reportRoutes)
  .use(exchangeRateRoutes)
  .listen(config.port);

console.log(`Centsible API running on http://localhost:${config.port}`);
if (!config.isProduction) {
  console.log(`Swagger docs at http://localhost:${config.port}/docs`);
}

export type App = typeof app;
