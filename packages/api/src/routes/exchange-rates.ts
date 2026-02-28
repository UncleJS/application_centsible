import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { EXCHANGE_RATE_API_BASE, SUPPORTED_CURRENCIES } from "@centsible/shared";

const supportedSet = new Set<string>(SUPPORTED_CURRENCIES);

function isValidCurrency(code: string): boolean {
  return supportedSet.has(code.toUpperCase());
}

export const exchangeRateRoutes = new Elysia({
  prefix: "/exchange-rates",
  detail: { tags: ["Exchange Rates"] },
})
  .use(authMiddleware)
  // ── Get latest rates for a base currency ──
  .get("/latest", async ({ query, set }) => {
    const base = (query.base || "GBP").toUpperCase();
    const target = query.target?.toUpperCase();

    if (!isValidCurrency(base)) {
      set.status = 400;
      return { error: `Unsupported base currency: ${base}` };
    }
    if (target && !isValidCurrency(target)) {
      set.status = 400;
      return { error: `Unsupported target currency: ${target}` };
    }

    try {
      const url = target
        ? `${EXCHANGE_RATE_API_BASE}/latest?from=${base}&to=${target}`
        : `${EXCHANGE_RATE_API_BASE}/latest?from=${base}`;

      const response = await fetch(url);
      if (!response.ok) {
        set.status = 502;
        return { error: "Failed to fetch exchange rates" };
      }

      const data = await response.json();

      // Cache rates in the database — batch insert instead of sequential
      const today = new Date().toISOString().slice(0, 10);
      if (data.rates) {
        const entries = Object.entries(data.rates as Record<string, number>);
        if (entries.length > 0) {
          const values = entries.map(([currency, rate]) => ({
            baseCurrency: base,
            targetCurrency: currency,
            rate: String(rate),
            date: today,
          }));

          // Insert all rates in a single batch; on conflict update the rate
          // Drizzle handles multi-row INSERT with ON DUPLICATE KEY UPDATE
          for (let i = 0; i < values.length; i += 50) {
            const batch = values.slice(i, i + 50);
            await db
              .insert(schema.exchangeRates)
              .values(batch)
              .onDuplicateKeyUpdate({
                set: {
                  rate: sql`VALUES(rate)`,
                },
              });
          }
        }
      }

      return { data };
    } catch (err) {
      // Fall back to cached rates
      const today = new Date().toISOString().slice(0, 10);
      const cached = await db
        .select()
        .from(schema.exchangeRates)
        .where(
          and(
            eq(schema.exchangeRates.baseCurrency, base),
            eq(schema.exchangeRates.date, today)
          )
        );

      if (cached.length > 0) {
        const rates: Record<string, string> = {};
        for (const r of cached) {
          rates[r.targetCurrency] = r.rate;
        }
        return { data: { base, date: today, rates }, cached: true };
      }

      set.status = 502;
      return { error: "Exchange rate service unavailable" };
    }
  })
  // ── Convert amount ──
  .get("/convert", async ({ query, set }) => {
    const { from, to, amount } = query;

    if (!from || !to || !amount) {
      set.status = 400;
      return { error: "Missing from, to, or amount parameter" };
    }

    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (!isValidCurrency(fromUpper)) {
      set.status = 400;
      return { error: `Unsupported source currency: ${fromUpper}` };
    }
    if (!isValidCurrency(toUpper)) {
      set.status = 400;
      return { error: `Unsupported target currency: ${toUpper}` };
    }

    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      set.status = 400;
      return { error: "Amount must be a positive number" };
    }

    try {
      const response = await fetch(
        `${EXCHANGE_RATE_API_BASE}/latest?amount=${numAmount}&from=${fromUpper}&to=${toUpper}`
      );

      if (!response.ok) {
        set.status = 502;
        return { error: "Failed to convert currency" };
      }

      const data = await response.json();
      return { data };
    } catch {
      set.status = 502;
      return { error: "Exchange rate service unavailable" };
    }
  })
  // ── List supported currencies ──
  .get("/currencies", () => {
    return { data: SUPPORTED_CURRENCIES };
  });
