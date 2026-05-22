import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { SUPPORTED_CURRENCIES } from "@centsible/shared";
import { config } from "../config";

const supportedSet = new Set<string>(SUPPORTED_CURRENCIES);
const MAX_CONVERSION_AMOUNT = 1_000_000_000;

function isValidCurrency(code: string): boolean {
  return supportedSet.has(code.toUpperCase());
}

/**
 * Sanity-check an exchange rate before persisting it. Catches upstream API
 * regressions where a rate flips direction (returning the inverse) or where
 * a same-currency pair would silently end up as something other than 1.0,
 * which would silently corrupt every conversion that uses it.
 */
const RATE_SANE_MIN = 1e-6;
const RATE_SANE_MAX = 1e6;

function rateRejectionReason(
  base: string,
  target: string,
  rate: number
): string | null {
  if (!Number.isFinite(rate)) return "non-finite";
  if (rate <= 0) return "non-positive";
  if (base === target && Math.abs(rate - 1) > 1e-6) return "same-currency-not-one";
  if (rate < RATE_SANE_MIN || rate > RATE_SANE_MAX) return "out-of-bounds";
  return null;
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
        ? `${config.exchangeRateApiBase}/latest?from=${base}&to=${target}`
        : `${config.exchangeRateApiBase}/latest?from=${base}`;

      const response = await fetch(url);
      if (!response.ok) {
        set.status = 502;
        return { error: "Failed to fetch exchange rates" };
      }

      const data = await response.json();

      // Cache rates in the database — batch insert instead of sequential.
      // Skip any rate that fails the sanity check so a regressed upstream
      // response can't silently corrupt every downstream conversion.
      const today = new Date().toISOString().slice(0, 10);
      if (data.rates) {
        const entries = Object.entries(data.rates as Record<string, number>);
        const values: Array<{
          baseCurrency: string;
          targetCurrency: string;
          rate: string;
          date: string;
        }> = [];
        for (const [currency, rate] of entries) {
          const target = currency.toUpperCase();
          const numeric = Number(rate);
          const rejection = rateRejectionReason(base, target, numeric);
          if (rejection) {
            console.warn(
              JSON.stringify({
                msg: "rejected-exchange-rate",
                base,
                target,
                rate: numeric,
                reason: rejection,
              })
            );
            continue;
          }
          values.push({
            baseCurrency: base,
            targetCurrency: target,
            rate: String(numeric),
            date: today,
          });
        }

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
    if (numAmount > MAX_CONVERSION_AMOUNT) {
      set.status = 400;
      return { error: `Amount must be less than or equal to ${MAX_CONVERSION_AMOUNT}` };
    }

    try {
      const response = await fetch(
        `${config.exchangeRateApiBase}/latest?amount=${numAmount}&from=${fromUpper}&to=${toUpper}`
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
