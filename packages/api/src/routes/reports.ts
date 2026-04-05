import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull, gte, lt, sql } from "drizzle-orm";
import { BILLING_CYCLE_MONTHS } from "@centsible/shared";
import type { ForecastMonth, ForecastItem } from "@centsible/shared";
import {
  convertToBaseCurrency,
  loadLatestRateMap,
  toFixed2,
  type ConversionWarning,
} from "../lib/currency";
import { getRecurringIncomeOccurrencesInMonth } from "../lib/forecast";

// ── Helpers ──

/** Validate year/month query params, return defaults if missing, 400 if invalid */
function parseYearMonth(query: { year?: string; month?: string }): {
  year: number;
  month: number;
  error?: string;
} {
  const now = new Date();
  let year = query.year ? Number(query.year) : now.getFullYear();
  let month = query.month ? Number(query.month) : now.getMonth() + 1;

  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return { year: 0, month: 0, error: "Invalid year parameter" };
  }
  if (Number.isNaN(month) || month < 1 || month > 12) {
    return { year: 0, month: 0, error: "Invalid month parameter" };
  }
  return { year, month };
}

/** Build start/end date strings for a given year/month period */
function periodDates(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { startDate, endDate };
}

/** Sanitise a single CSV cell to prevent formula injection */
function csvSafeCell(value: string): string {
  // If the value starts with a formula trigger character, prefix with a single quote
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export const reportRoutes = new Elysia({
  prefix: "/reports",
  detail: { tags: ["Reports"] },
})
  .use(authMiddleware)
  // ── Monthly summary ──
  .get("/summary", async ({ user, query, set }) => {
    const parsed = parseYearMonth(query);
    if (parsed.error) {
      set.status = 400;
      return { error: parsed.error };
    }
    const { year, month } = parsed;
    const { startDate, endDate } = periodDates(year, month);

    // Get totals by type+currency
    const totals = await db
      .select({
        type: schema.transactions.type,
        currency: schema.transactions.currency,
        total: sql<string>`SUM(${schema.transactions.amount})`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.archivedAt),
          gte(schema.transactions.date, startDate),
          lt(schema.transactions.date, endDate)
        )
      )
      .groupBy(schema.transactions.type, schema.transactions.currency);

    // Get breakdown by category+currency
    const byCategoryRaw = await db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        categoryIcon: schema.categories.icon,
        categoryColor: schema.categories.color,
        type: schema.transactions.type,
        currency: schema.transactions.currency,
        totalAmount: sql<string>`SUM(${schema.transactions.amount})`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.archivedAt),
          gte(schema.transactions.date, startDate),
          lt(schema.transactions.date, endDate)
        )
      )
      .groupBy(
        schema.transactions.categoryId,
        schema.categories.name,
        schema.categories.icon,
        schema.categories.color,
        schema.transactions.type,
        schema.transactions.currency
      );

    // Get budgets for the month to calculate percent used
    const monthBudgets = await db
      .select()
      .from(schema.budgets)
      .where(
        and(
          eq(schema.budgets.userId, user.id),
          eq(schema.budgets.year, year),
          eq(schema.budgets.month, month),
          isNull(schema.budgets.archivedAt)
        )
      );

    const currencies = new Set<string>();
    for (const row of totals) currencies.add(row.currency);
    for (const row of byCategoryRaw) currencies.add(row.currency);
    for (const row of monthBudgets) currencies.add(row.currency);

    const rates = await loadLatestRateMap(user.defaultCurrency, currencies);
    const warnings: ConversionWarning[] = [];

    let totalIncomeValue = 0;
    let totalExpensesValue = 0;
    for (const row of totals) {
      const converted = convertToBaseCurrency(
        row.total,
        row.currency,
        user.defaultCurrency,
        rates
      );
      if (converted.warning) warnings.push(converted.warning);
      if (row.type === "income") totalIncomeValue += converted.value;
      else if (row.type === "expense") totalExpensesValue += converted.value;
    }

    const totalIncome = toFixed2(totalIncomeValue);
    const totalExpenses = toFixed2(totalExpensesValue);
    const netAmount = toFixed2(totalIncomeValue - totalExpensesValue);

    const budgetMap = new Map<number, number>();
    for (const budget of monthBudgets) {
      const converted = convertToBaseCurrency(
        budget.amount,
        budget.currency,
        user.defaultCurrency,
        rates
      );
      if (converted.warning) warnings.push(converted.warning);
      budgetMap.set(budget.categoryId, converted.value);
    }

    const categoryMap = new Map<
      string,
      {
        categoryId: number;
        categoryName: string | null;
        categoryIcon: string | null;
        categoryColor: string | null;
        type: "income" | "expense";
        totalAmount: number;
        transactionCount: number;
      }
    >();

    for (const row of byCategoryRaw) {
      const key = `${row.categoryId}:${row.type}`;
      const converted = convertToBaseCurrency(
        row.totalAmount,
        row.currency,
        user.defaultCurrency,
        rates
      );
      if (converted.warning) warnings.push(converted.warning);

      const existing = categoryMap.get(key);
      if (existing) {
        existing.totalAmount += converted.value;
        existing.transactionCount += Number(row.transactionCount);
      } else {
        categoryMap.set(key, {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          categoryIcon: row.categoryIcon,
          categoryColor: row.categoryColor,
          type: row.type === "income" ? "income" : "expense",
          totalAmount: converted.value,
          transactionCount: Number(row.transactionCount),
        });
      }
    }

    const categorySummary = Array.from(categoryMap.values()).map((c) => {
      const budgetAmountNum = budgetMap.get(c.categoryId) ?? null;
      const budgetAmount = budgetAmountNum === null ? null : toFixed2(budgetAmountNum);
      const percentUsed = budgetAmount
        ? (c.totalAmount / parseFloat(budgetAmount)) * 100
        : null;

      return {
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        categoryIcon: c.categoryIcon,
        categoryColor: c.categoryColor,
        type: c.type,
        totalAmount: toFixed2(c.totalAmount),
        budgetAmount,
        percentUsed: percentUsed !== null ? Math.round(percentUsed) : null,
        transactionCount: c.transactionCount,
      };
    });

    const conversionWarnings = Array.from(
      new Map(
        warnings.map((w) => [`${w.from}-${w.to}-${w.reason}`, w])
      ).values()
    );

    return {
      data: {
        year,
        month,
        totalIncome,
        totalExpenses,
        netAmount,
        currency: user.defaultCurrency,
        byCategory: categorySummary,
        conversionWarnings,
      },
    };
  })
  // ── Forward expense forecast (up to 12 months) ──
  .get("/forecast", async ({ user, query }) => {
    const months = Math.min(Math.max(Number(query.months) || 3, 1), 12);
    const today = new Date();
    const forecast: ForecastMonth[] = [];

    // Get active subscriptions (expense-only)
    const subs = await db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, user.id),
          isNull(schema.subscriptions.archivedAt)
        )
      );

    // Get active recurring income sources
    const incomeRows = await db
      .select()
      .from(schema.recurringIncome)
      .where(
        and(
          eq(schema.recurringIncome.userId, user.id),
          isNull(schema.recurringIncome.archivedAt)
        )
      );

    // Get active savings goals
    const goals = await db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.userId, user.id),
          isNull(schema.savingsGoals.archivedAt)
        )
      );

    // Get latest month's budgets as baseline
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Expense budgets only
    const latestBudgets = await db
      .select({
        categoryId: schema.budgets.categoryId,
        categoryName: schema.categories.name,
        amount: schema.budgets.amount,
        currency: schema.budgets.currency,
      })
      .from(schema.budgets)
      .leftJoin(
        schema.categories,
        eq(schema.budgets.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.budgets.userId, user.id),
          eq(schema.budgets.year, currentYear),
          eq(schema.budgets.month, currentMonth),
          isNull(schema.budgets.archivedAt),
          eq(schema.categories.type, "expense")
        )
      );

    // Income budgets (once-off / manually set income for the month)
    const latestIncomeBudgets = await db
      .select({
        categoryId: schema.budgets.categoryId,
        categoryName: schema.categories.name,
        amount: schema.budgets.amount,
        currency: schema.budgets.currency,
      })
      .from(schema.budgets)
      .leftJoin(
        schema.categories,
        eq(schema.budgets.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.budgets.userId, user.id),
          eq(schema.budgets.year, currentYear),
          eq(schema.budgets.month, currentMonth),
          isNull(schema.budgets.archivedAt),
          eq(schema.categories.type, "income")
        )
      );

    const currencies = new Set<string>();
    for (const sub of subs) currencies.add(sub.currency);
    for (const inc of incomeRows) currencies.add(inc.currency);
    for (const goal of goals) currencies.add(goal.currency);
    for (const b of latestBudgets) currencies.add(b.currency);
    for (const b of latestIncomeBudgets) currencies.add(b.currency);

    const rates = await loadLatestRateMap(user.defaultCurrency, currencies);
    const forecastWarnings: ConversionWarning[] = [];

    // i=0 → current month; i=1 → next month; etc.
    for (let i = 0; i < months; i++) {
      const fYear = today.getMonth() + i >= 12
        ? today.getFullYear() + Math.floor((today.getMonth() + i) / 12)
        : today.getFullYear();
      const fMonth = ((today.getMonth() + i) % 12) + 1;
      const items: ForecastItem[] = [];

      // Calculate subscription costs for this month (expense subscriptions)
      let subscriptionTotal = 0;
      for (const sub of subs) {
        const renewals = getSubscriptionRenewalsInMonth(sub, fYear, fMonth);
        for (const renewal of renewals) {
          const converted = convertToBaseCurrency(
            sub.amount,
            sub.currency,
            user.defaultCurrency,
            rates
          );
          if (converted.warning) forecastWarnings.push(converted.warning);
          subscriptionTotal += converted.value;
          items.push({
            name: sub.name,
            amount: sub.amount,
            currency: sub.currency,
            date: renewal,
            type: "subscription",
            sourceId: sub.id,
          });
        }
      }

      // Calculate recurring income for this month
      let recurringIncomeTotal = 0;
      for (const inc of incomeRows) {
        if (!inc.autoRenew) continue;
        const occurrences = getRecurringIncomeOccurrencesInMonth(inc, fYear, fMonth);
        if (occurrences > 0) {
          const converted = convertToBaseCurrency(
            inc.amount,
            inc.currency,
            user.defaultCurrency,
            rates
          );
          if (converted.warning) forecastWarnings.push(converted.warning);
          recurringIncomeTotal += converted.value * occurrences;

          const amountPerOccurrence = Number(inc.amount);
          const totalOriginalAmount = Number.isFinite(amountPerOccurrence)
            ? toFixed2(amountPerOccurrence * occurrences)
            : inc.amount;

          items.push({
            name: occurrences > 1 ? `${inc.name} (${occurrences}×)` : inc.name,
            amount: totalOriginalAmount,
            currency: inc.currency,
            date: `${fYear}-${String(fMonth).padStart(2, "0")}-01`,
            type: "recurring-income",
            sourceId: inc.id,
          });
        }
      }

      // Estimate savings goal contributions for this month
      let savingsTotal = 0;
      for (const goal of goals) {
        const remaining =
          parseFloat(goal.targetAmount) - parseFloat(goal.currentAmount || "0");
        if (remaining <= 0) continue;

        const targetDate = new Date(goal.targetDate + "T00:00:00Z");
        // Calculate months remaining relative to the forecast month, not today
        const monthsRemaining = Math.max(
          1,
          (targetDate.getUTCFullYear() - fYear) * 12 +
            (targetDate.getUTCMonth() + 1 - fMonth)
        );

        const forecastMonthStart = new Date(Date.UTC(fYear, fMonth - 1, 1));

        if (forecastMonthStart <= targetDate) {
          const monthlyContribution = remaining / monthsRemaining;
          const converted = convertToBaseCurrency(
            monthlyContribution,
            goal.currency,
            user.defaultCurrency,
            rates
          );
          if (converted.warning) forecastWarnings.push(converted.warning);
          savingsTotal += converted.value;
          items.push({
            name: `Savings: ${goal.name}`,
            amount: monthlyContribution.toFixed(2),
            currency: goal.currency,
            date: `${fYear}-${String(fMonth).padStart(2, "0")}-01`,
            type: "savings",
            sourceId: goal.id,
          });
        }
      }

      // Add expense budget amounts as projected expenses
      let budgetTotal = 0;
      for (const budget of latestBudgets) {
        const converted = convertToBaseCurrency(
          budget.amount,
          budget.currency,
          user.defaultCurrency,
          rates
        );
        if (converted.warning) forecastWarnings.push(converted.warning);
        budgetTotal += converted.value;
        items.push({
          name: `Budget: ${budget.categoryName}`,
          amount: budget.amount,
          currency: budget.currency,
          date: `${fYear}-${String(fMonth).padStart(2, "0")}-01`,
          type: "budget",
          sourceId: budget.categoryId,
        });
      }

      // Add income budget amounts (once-off / manually set income)
      let budgetedIncomeTotal = 0;
      for (const budget of latestIncomeBudgets) {
        const converted = convertToBaseCurrency(
          budget.amount,
          budget.currency,
          user.defaultCurrency,
          rates
        );
        if (converted.warning) forecastWarnings.push(converted.warning);
        budgetedIncomeTotal += converted.value;
        items.push({
          name: `Income: ${budget.categoryName}`,
          amount: budget.amount,
          currency: budget.currency,
          date: `${fYear}-${String(fMonth).padStart(2, "0")}-01`,
          type: "income-budget",
          sourceId: budget.categoryId,
        });
      }

      const totalIncome = recurringIncomeTotal + budgetedIncomeTotal;
      const totalExpenses = subscriptionTotal + savingsTotal + budgetTotal;
      const totalProjected = totalIncome - totalExpenses;

      forecast.push({
        year: fYear,
        month: fMonth,
        projectedExpenses: toFixed2(budgetTotal),
        projectedIncome: toFixed2(totalIncome),
        subscriptionCosts: toFixed2(subscriptionTotal),
        recurringIncomeSources: toFixed2(recurringIncomeTotal),
        savingsContributions: toFixed2(savingsTotal),
        totalProjected: toFixed2(totalProjected),
        items: items.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
      });
    }

    const conversionWarnings = Array.from(
      new Map(
        forecastWarnings.map((w) => [`${w.from}-${w.to}-${w.reason}`, w])
      ).values()
    );

    return {
      data: forecast,
      currency: user.defaultCurrency,
      conversionWarnings,
    };
  })
  // ── Monthly trend (last N months) ──
  .get("/trend", async ({ user, query }) => {
    const months = Math.min(Math.max(Number(query.months) || 6, 1), 24);
    const today = new Date();

    // Calculate overall date range for single query
    const startD = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    const endD = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const rangeStart = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, "0")}-01`;
    const rangeEnd = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-01`;

    // Single query with GROUP BY year/month instead of N+1 loop
    const totals = await db
      .select({
        year: sql<number>`YEAR(${schema.transactions.date})`,
        month: sql<number>`MONTH(${schema.transactions.date})`,
        type: schema.transactions.type,
        currency: schema.transactions.currency,
        total: sql<string>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.archivedAt),
          gte(schema.transactions.date, rangeStart),
          lt(schema.transactions.date, rangeEnd)
        )
      )
      .groupBy(
        sql`YEAR(${schema.transactions.date})`,
        sql`MONTH(${schema.transactions.date})`,
        schema.transactions.type,
        schema.transactions.currency
      );

    const rates = await loadLatestRateMap(
      user.defaultCurrency,
      totals.map((t) => t.currency)
    );

    // Build a lookup map: "YYYY-MM" → { income, expenses }
    const lookup = new Map<string, { income: number; expenses: number }>();
    for (const row of totals) {
      const key = `${row.year}-${row.month}`;
      if (!lookup.has(key)) {
        lookup.set(key, { income: 0, expenses: 0 });
      }
      const entry = lookup.get(key)!;
      const converted = convertToBaseCurrency(
        row.total,
        row.currency,
        user.defaultCurrency,
        rates
      );
      if (row.type === "income") entry.income += converted.value;
      else if (row.type === "expense") entry.expenses += converted.value;
    }

    // Build results array in chronological order
    const results = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      const entry = lookup.get(key) || { income: 0, expenses: 0 };

      results.push({
        year,
        month,
        income: toFixed2(entry.income),
        expenses: toFixed2(entry.expenses),
        net: toFixed2(entry.income - entry.expenses),
      });
    }

    return { data: results };
  })
  // ── Export transactions as CSV ──
  .get("/export", async ({ user, query, set }) => {
    const parsed = parseYearMonth(query);
    if (parsed.error) {
      set.status = 400;
      return { error: parsed.error };
    }
    const { year, month } = parsed;
    const { startDate, endDate } = periodDates(year, month);

    const rows = await db
      .select({
        date: schema.transactions.date,
        type: schema.transactions.type,
        category: schema.categories.name,
        description: schema.transactions.description,
        amount: schema.transactions.amount,
        currency: schema.transactions.currency,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.archivedAt),
          gte(schema.transactions.date, startDate),
          lt(schema.transactions.date, endDate)
        )
      )
      .orderBy(schema.transactions.date);

    const csv = [
      "Date,Type,Category,Description,Amount,Currency",
      ...rows.map(
        (r) =>
          `${r.date},${r.type},"${csvSafeCell(r.category || "")}","${csvSafeCell((r.description || "").replace(/"/g, '""'))}",${r.amount},${r.currency}`
      ),
    ].join("\n");

    set.headers["content-type"] = "text/csv";
    set.headers["content-disposition"] =
      `attachment; filename="centsible-${year}-${String(month).padStart(2, "0")}.csv"`;

    return csv;
  });

// ── Helper: Calculate subscription renewal dates within a given month ──

function getSubscriptionRenewalsInMonth(
  sub: {
    nextRenewalDate: string;
    billingCycle: string;
    autoRenew: boolean;
  },
  year: number,
  month: number
): string[] {
  if (!sub.autoRenew) return [];

  const renewals: string[] = [];
  const cycleMonths = BILLING_CYCLE_MONTHS[sub.billingCycle] || 1;

  // Guard against non-positive cycle which would cause infinite loop
  if (cycleMonths <= 0) return [];

  // Build month boundary strings (YYYY-MM-DD) using UTC to avoid timezone drift
  const monthStartStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayUtc = new Date(Date.UTC(year, month, 0)); // day-0 of next month = last day of this month
  const monthEndStr = lastDayUtc.toISOString().slice(0, 10);

  // Start from the stored next renewal date and step forward in billing cycle increments.
  // Parse as UTC so date strings stay stable regardless of server timezone.
  let current = new Date(sub.nextRenewalDate + "T00:00:00Z");

  // Safety limit to prevent runaway loops (max 200 iterations)
  let iterations = 0;

  while (iterations < 200) {
    iterations++;
    const currentStr = current.toISOString().slice(0, 10);

    // Past the end of the target month — stop
    if (currentStr > monthEndStr) break;

    // Within the target month — record it
    if (currentStr >= monthStartStr && currentStr <= monthEndStr) {
      renewals.push(currentStr);
    }

    // Advance by billing cycle
    if (cycleMonths >= 1) {
      const nextMonth = current.getUTCMonth() + Math.round(cycleMonths);
      const nextDay = current.getUTCDate();
      // Use UTC constructor; JS handles month overflow automatically
      current = new Date(Date.UTC(current.getUTCFullYear(), nextMonth, nextDay));
    } else {
      // Sub-monthly (weekly / fortnightly)
      const days = Math.round(cycleMonths * 30.44);
      current = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);
    }
  }

  return renewals;
}
