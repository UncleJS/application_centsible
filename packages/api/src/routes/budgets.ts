import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull, sql, gte, lt } from "drizzle-orm";
import {
  convertToBaseCurrency,
  loadLatestRateMap,
  toFixed2,
  type ConversionWarning,
} from "../lib/currency";

const amountPattern = "^\\d+(\\.\\d{1,2})?$";

function validateYearMonth(
  yearRaw: string | undefined,
  monthRaw: string | undefined
): { year: number; month: number } | { error: string } {
  const now = new Date();
  const year = yearRaw ? parseInt(yearRaw, 10) : now.getFullYear();
  const month = monthRaw ? parseInt(monthRaw, 10) : now.getMonth() + 1;

  if (isNaN(year) || year < 2020 || year > 2100) {
    return { error: "Year must be between 2020 and 2100" };
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return { error: "Month must be between 1 and 12" };
  }
  return { year, month };
}

export const budgetRoutes = new Elysia({
  prefix: "/budgets",
  detail: { tags: ["Budgets"] },
})
  .use(authMiddleware)
  // ── List budgets for a given month ──
  .get(
    "/",
    async ({ user, query, set }) => {
      const result = validateYearMonth(query.year, query.month);
      if ("error" in result) {
        set.status = 400;
        return { error: result.error };
      }
      const { year, month } = result;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const rows = await db
        .select({
          id: schema.budgets.id,
          userId: schema.budgets.userId,
          categoryId: schema.budgets.categoryId,
          categoryName: schema.categories.name,
          categoryIcon: schema.categories.icon,
          categoryColor: schema.categories.color,
          categoryType: schema.categories.type,
          year: schema.budgets.year,
          month: schema.budgets.month,
          amount: schema.budgets.amount,
          currency: schema.budgets.currency,
          spent: sql<string>`COALESCE(SUM(${schema.transactions.amount}), 0.00)`,
          createdAt: schema.budgets.createdAt,
          updatedAt: schema.budgets.updatedAt,
        })
        .from(schema.budgets)
        .leftJoin(
          schema.categories,
          eq(schema.budgets.categoryId, schema.categories.id)
        )
        .leftJoin(
          schema.transactions,
          and(
            eq(schema.transactions.userId, user.id),
            eq(schema.transactions.categoryId, schema.budgets.categoryId),
            isNull(schema.transactions.archivedAt),
            gte(schema.transactions.date, startDate),
            lt(schema.transactions.date, endDate)
          )
        )
        .where(
          and(
            eq(schema.budgets.userId, user.id),
            eq(schema.budgets.year, year),
            eq(schema.budgets.month, month),
            isNull(schema.budgets.archivedAt)
          )
        )
        .groupBy(
          schema.budgets.id,
          schema.budgets.userId,
          schema.budgets.categoryId,
          schema.categories.name,
          schema.categories.icon,
          schema.categories.color,
          schema.categories.type,
          schema.budgets.year,
          schema.budgets.month,
          schema.budgets.amount,
          schema.budgets.currency,
          schema.budgets.createdAt,
          schema.budgets.updatedAt
        );

      const txByCategoryCurrency = await db
        .select({
          categoryId: schema.transactions.categoryId,
          currency: schema.transactions.currency,
          totalAmount: sql<string>`COALESCE(SUM(${schema.transactions.amount}), 0.00)`,
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
        .groupBy(schema.transactions.categoryId, schema.transactions.currency);

      const currencies = new Set<string>();
      for (const row of rows) currencies.add(row.currency);
      for (const row of txByCategoryCurrency) currencies.add(row.currency);

      const rates = await loadLatestRateMap(user.defaultCurrency, currencies);
      const warnings: ConversionWarning[] = [];

      const spentInUserByCategory = new Map<number, number>();
      for (const tx of txByCategoryCurrency) {
        const converted = convertToBaseCurrency(
          tx.totalAmount,
          tx.currency,
          user.defaultCurrency,
          rates
        );
        if (converted.warning) warnings.push(converted.warning);

        const prev = spentInUserByCategory.get(tx.categoryId) ?? 0;
        spentInUserByCategory.set(tx.categoryId, prev + converted.value);
      }

      const enriched = rows.map((row) => {
        const convertedBudget = convertToBaseCurrency(
          row.amount,
          row.currency,
          user.defaultCurrency,
          rates
        );
        if (convertedBudget.warning) warnings.push(convertedBudget.warning);

        return {
          ...row,
          amountInUserCurrency: toFixed2(convertedBudget.value),
          spentInUserCurrency: toFixed2(
            spentInUserByCategory.get(row.categoryId) ?? 0
          ),
          userCurrency: user.defaultCurrency,
        };
      });

      const uniqueWarnings = Array.from(
        new Map(
          warnings.map((w) => [`${w.from}-${w.to}-${w.reason}`, w])
        ).values()
      );

      return {
        data: enriched,
        currency: user.defaultCurrency,
        conversionWarnings: uniqueWarnings,
      };
    }
  )
  // ── Create or update budget (atomic upsert) ──
  .post(
    "/",
    async ({ body, user, set }) => {
      const { categoryId, year, month, amount, currency } = body;

      // Verify category belongs to user
      const [category] = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, categoryId),
            eq(schema.categories.userId, user.id),
            isNull(schema.categories.archivedAt)
          )
        );

      if (!category) {
        set.status = 400;
        return { error: "Invalid category" };
      }

      // Atomic upsert using ON DUPLICATE KEY UPDATE
      // Uses the unique index: budgets_user_cat_period_unique(userId, categoryId, year, month)
      await db
        .insert(schema.budgets)
        .values({ categoryId, year, month, amount, currency, userId: user.id })
        .onDuplicateKeyUpdate({
          set: { amount, currency },
        });

      // Fetch the upserted row
      const [result] = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.userId, user.id),
            eq(schema.budgets.categoryId, categoryId),
            eq(schema.budgets.year, year),
            eq(schema.budgets.month, month),
            isNull(schema.budgets.archivedAt)
          )
        );

      return { data: result };
    },
    {
      body: t.Object({
        categoryId: t.Integer({ minimum: 1 }),
        year: t.Integer({ minimum: 2020, maximum: 2100 }),
        month: t.Integer({ minimum: 1, maximum: 12 }),
        amount: t.String({ pattern: amountPattern, error: "Amount must be a valid decimal" }),
        currency: t.String({ minLength: 3, maxLength: 3 }),
      }),
    }
  )
  // ── Update budget amount ──
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);

      const [existing] = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.id, id),
            eq(schema.budgets.userId, user.id),
            isNull(schema.budgets.archivedAt)
          )
        );

      if (!existing) {
        set.status = 404;
        return { error: "Budget not found" };
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      if (
        existing.year < currentYear ||
        (existing.year === currentYear && existing.month < currentMonth)
      ) {
        set.status = 403;
        return { error: "Cannot edit budgets for past months" };
      }

      await db
        .update(schema.budgets)
        .set({ amount: body.amount })
        .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, user.id)));

      const [updated] = await db
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.id, id));

      return { data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        amount: t.String({ pattern: amountPattern, error: "Amount must be a valid decimal" }),
      }),
    }
  )
  // ── Archive budget ──
  .delete("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.budgets)
      .where(
        and(
          eq(schema.budgets.id, id),
          eq(schema.budgets.userId, user.id),
          isNull(schema.budgets.archivedAt)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Budget not found" };
    }

    const nowDel = new Date();
    const currentYearDel = nowDel.getFullYear();
    const currentMonthDel = nowDel.getMonth() + 1;
    if (
      existing.year < currentYearDel ||
      (existing.year === currentYearDel && existing.month < currentMonthDel)
    ) {
      set.status = 403;
      return { error: "Cannot edit budgets for past months" };
    }

    await db
      .update(schema.budgets)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, user.id)));

    return { data: { message: "Budget archived" } };
  }, {
    params: t.Object({ id: t.String() }),
  });
