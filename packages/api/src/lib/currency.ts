import { and, desc, eq, inArray } from "drizzle-orm";

export type ConversionWarning = {
  from: string;
  to: string;
  reason: "missing-rate" | "invalid-rate";
};

export function toFixed2(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

export async function loadLatestRateMap(
  baseCurrency: string,
  sourceCurrencies: Iterable<string>
): Promise<Map<string, number>> {
  const needed = [...new Set(sourceCurrencies)]
    .map((c) => c.toUpperCase())
    .filter((c) => c && c !== baseCurrency.toUpperCase());

  if (needed.length === 0) return new Map();

  const { db, schema } = await import("../db");

  const rows = await db
    .select({
      targetCurrency: schema.exchangeRates.targetCurrency,
      rate: schema.exchangeRates.rate,
      date: schema.exchangeRates.date,
    })
    .from(schema.exchangeRates)
    .where(
      and(
        eq(schema.exchangeRates.baseCurrency, baseCurrency.toUpperCase()),
        inArray(schema.exchangeRates.targetCurrency, needed)
      )
    )
    .orderBy(desc(schema.exchangeRates.date));

  const byTarget = new Map<string, number>();
  for (const row of rows) {
    if (byTarget.has(row.targetCurrency)) continue; // keep latest only
    byTarget.set(row.targetCurrency, Number(row.rate));
  }

  return byTarget;
}

export function convertToBaseCurrency(
  amount: string | number,
  sourceCurrency: string,
  baseCurrency: string,
  rates: Map<string, number>
): { value: number; warning?: ConversionWarning } {
  const numericAmount = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(numericAmount)) {
    return { value: 0 };
  }

  const from = sourceCurrency.toUpperCase();
  const to = baseCurrency.toUpperCase();

  if (from === to) {
    return { value: numericAmount };
  }

  const rate = rates.get(from);
  if (rate === undefined) {
    return {
      value: numericAmount,
      warning: { from, to, reason: "missing-rate" },
    };
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      value: numericAmount,
      warning: { from, to, reason: "invalid-rate" },
    };
  }

  // Rates are stored as: 1 baseCurrency = rate * targetCurrency.
  // Convert source(target) -> base by dividing.
  return { value: numericAmount / rate };
}
