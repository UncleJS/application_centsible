import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull, gte, lte, desc, sql, like } from "drizzle-orm";

const amountPattern = "^\\d+(\\.\\d{1,2})?$";
const datePattern = "^\\d{4}-\\d{2}-\\d{2}$";

export const transactionRoutes = new Elysia({
  prefix: "/transactions",
  detail: { tags: ["Transactions"] },
})
  .use(authMiddleware)
  // ── List transactions (filtered + paginated) ──
  .get(
    "/",
    async ({ user, query, set }) => {
      const queryParams = query as Record<string, string | undefined>;
      const page = Math.max(1, Number(queryParams.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize) || 20));
      const dateFrom = queryParams.dateFrom ?? queryParams.from;
      const dateTo = queryParams.dateTo ?? queryParams.to;
      const search = queryParams.search?.trim();

      const conditions = [
        eq(schema.transactions.userId, user.id),
        isNull(schema.transactions.archivedAt),
      ];

      if (queryParams.type) {
        if (queryParams.type !== "income" && queryParams.type !== "expense") {
          set.status = 400;
          return { error: "type must be 'income' or 'expense'" };
        }
        conditions.push(eq(schema.transactions.type, queryParams.type));
      }
      if (queryParams.categoryId) {
        const catId = Number(queryParams.categoryId);
        if (isNaN(catId) || catId <= 0) {
          set.status = 400;
          return { error: "categoryId must be a positive integer" };
        }
        conditions.push(eq(schema.transactions.categoryId, catId));
      }
      if (dateFrom) {
        if (!new RegExp(datePattern).test(dateFrom)) {
          set.status = 400;
          return { error: "dateFrom must be YYYY-MM-DD format" };
        }
        conditions.push(gte(schema.transactions.date, dateFrom));
      }
      if (dateTo) {
        if (!new RegExp(datePattern).test(dateTo)) {
          set.status = 400;
          return { error: "dateTo must be YYYY-MM-DD format" };
        }
        conditions.push(lte(schema.transactions.date, dateTo));
      }
      if (search) {
        conditions.push(like(schema.transactions.description, `%${search.slice(0, 100)}%`));
      }

      const whereClause = and(...conditions);

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.transactions)
        .where(whereClause);

      const total = Number(countResult.count);
      const offset = (page - 1) * pageSize;

      const rows = await db
        .select({
          id: schema.transactions.id,
          userId: schema.transactions.userId,
          categoryId: schema.transactions.categoryId,
          categoryName: schema.categories.name,
          categoryIcon: schema.categories.icon,
          categoryColor: schema.categories.color,
          type: schema.transactions.type,
          amount: schema.transactions.amount,
          currency: schema.transactions.currency,
          convertedAmount: schema.transactions.convertedAmount,
          description: schema.transactions.description,
          date: schema.transactions.date,
          subscriptionId: schema.transactions.subscriptionId,
          isRecurring: schema.transactions.isRecurring,
          createdAt: schema.transactions.createdAt,
          updatedAt: schema.transactions.updatedAt,
        })
        .from(schema.transactions)
        .leftJoin(
          schema.categories,
          eq(schema.transactions.categoryId, schema.categories.id)
        )
        .where(whereClause)
        .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
        .limit(pageSize)
        .offset(offset);

      return {
        data: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }
  )
  // ── Create transaction ──
  .post(
    "/",
    async ({ body, user, set }) => {
      // Verify category belongs to user
      const [category] = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, body.categoryId),
            eq(schema.categories.userId, user.id),
            isNull(schema.categories.archivedAt)
          )
        );

      if (!category) {
        set.status = 400;
        return { error: "Invalid category" };
      }

      // Validate transaction type matches category type
      if (category.type !== body.type) {
        set.status = 400;
        return { error: `Transaction type "${body.type}" does not match category type "${category.type}"` };
      }

      const [result] = await db
        .insert(schema.transactions)
        .values({
          categoryId: body.categoryId,
          type: body.type,
          amount: body.amount,
          currency: body.currency,
          description: body.description ?? "",
          date: body.date,
          userId: user.id,
          subscriptionId: body.subscriptionId ?? null,
          isRecurring: body.isRecurring ?? (body.subscriptionId ? true : false),
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, result.id));

      set.status = 201;
      return { data: created };
    },
    {
      body: t.Object({
        categoryId: t.Integer({ minimum: 1 }),
        type: t.Union([t.Literal("income"), t.Literal("expense")]),
        amount: t.String({ pattern: amountPattern, error: "Amount must be a valid decimal with up to 2 decimal places" }),
        currency: t.String({ minLength: 3, maxLength: 3 }),
        description: t.Optional(t.String({ maxLength: 255 })),
        date: t.String({ pattern: datePattern, error: "Date must be YYYY-MM-DD format" }),
        subscriptionId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
        isRecurring: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── Update transaction ──
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);

      const [existing] = await db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.id, id),
            eq(schema.transactions.userId, user.id),
            isNull(schema.transactions.archivedAt)
          )
        );

      if (!existing) {
        set.status = 404;
        return { error: "Transaction not found" };
      }

      // If categoryId is being changed, validate ownership and type match
      if (body.categoryId) {
        const [category] = await db
          .select()
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.id, body.categoryId),
              eq(schema.categories.userId, user.id),
              isNull(schema.categories.archivedAt)
            )
          );

        if (!category) {
          set.status = 400;
          return { error: "Invalid category" };
        }

        const effectiveType = body.type || existing.type;
        if (category.type !== effectiveType) {
          set.status = 400;
          return { error: `Transaction type "${effectiveType}" does not match category type "${category.type}"` };
        }
      }

      await db
        .update(schema.transactions)
        .set(body)
        .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, user.id)));

      const [updated] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, id));

      return { data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        categoryId: t.Optional(t.Integer({ minimum: 1 })),
        type: t.Optional(t.Union([t.Literal("income"), t.Literal("expense")])),
        amount: t.Optional(t.String({ pattern: amountPattern })),
        currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        description: t.Optional(t.String({ maxLength: 255 })),
        date: t.Optional(t.String({ pattern: datePattern })),
        subscriptionId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
        isRecurring: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── Archive transaction ──
  .delete("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.archivedAt)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Transaction not found" };
    }

    await db
      .update(schema.transactions)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, user.id)));

    return { data: { message: "Transaction archived" } };
  }, {
    params: t.Object({ id: t.String() }),
  });
