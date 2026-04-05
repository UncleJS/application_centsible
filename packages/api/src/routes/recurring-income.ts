import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { isSupportedCurrency, supportedCurrencyError } from "../lib/supported-currency";

const amountPattern = "^\\d+(\\.\\d{1,2})?$";

export const recurringIncomeRoutes = new Elysia({
  prefix: "/recurring-income",
  detail: { tags: ["Recurring Income"] },
})
  .use(authMiddleware)
  // ── List recurring income ──
  .get("/", async ({ user }) => {
    const rows = await db
      .select({
        id: schema.recurringIncome.id,
        userId: schema.recurringIncome.userId,
        categoryId: schema.recurringIncome.categoryId,
        categoryName: schema.categories.name,
        categoryIcon: schema.categories.icon,
        name: schema.recurringIncome.name,
        description: schema.recurringIncome.description,
        amount: schema.recurringIncome.amount,
        currency: schema.recurringIncome.currency,
        billingCycle: schema.recurringIncome.billingCycle,
        autoRenew: schema.recurringIncome.autoRenew,
        createdAt: schema.recurringIncome.createdAt,
        updatedAt: schema.recurringIncome.updatedAt,
        archivedAt: schema.recurringIncome.archivedAt,
      })
      .from(schema.recurringIncome)
      .leftJoin(
        schema.categories,
        eq(schema.recurringIncome.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.recurringIncome.userId, user.id),
          isNull(schema.recurringIncome.archivedAt)
        )
      )
      .orderBy(schema.recurringIncome.name);

    return { data: rows };
  })
  // ── Create recurring income ──
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!isSupportedCurrency(body.currency)) {
        set.status = 400;
        return { error: supportedCurrencyError() };
      }

      // Verify category ownership if provided
      if (body.categoryId) {
        const [category] = await db
          .select({ id: schema.categories.id })
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
      }

      const [result] = await db
        .insert(schema.recurringIncome)
        .values({
          name: body.name,
          description: body.description ?? null,
          amount: body.amount,
          currency: body.currency,
          billingCycle: body.billingCycle,
          autoRenew: body.autoRenew ?? true,
          userId: user.id,
          categoryId: body.categoryId ?? null,
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(schema.recurringIncome)
        .where(eq(schema.recurringIncome.id, result.id));

      set.status = 201;
      return { data: created };
    },
    {
      body: t.Object({
        categoryId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        amount: t.String({ pattern: amountPattern, error: "Amount must be a valid decimal" }),
        currency: t.String({ minLength: 3, maxLength: 3 }),
        billingCycle: t.Union([
          t.Literal("weekly"),
          t.Literal("fortnightly"),
          t.Literal("monthly"),
          t.Literal("quarterly"),
          t.Literal("yearly"),
        ]),
        autoRenew: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── Update recurring income ──
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);

      if (body.currency !== undefined && !isSupportedCurrency(body.currency)) {
        set.status = 400;
        return { error: supportedCurrencyError() };
      }

      const [existing] = await db
        .select()
        .from(schema.recurringIncome)
        .where(
          and(
            eq(schema.recurringIncome.id, id),
            eq(schema.recurringIncome.userId, user.id),
            isNull(schema.recurringIncome.archivedAt)
          )
        );

      if (!existing) {
        set.status = 404;
        return { error: "Recurring income not found" };
      }

      // Verify category ownership if being changed
      if (body.categoryId) {
        const [category] = await db
          .select({ id: schema.categories.id })
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
      }

      const updateData: Partial<typeof body> = {};
      if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.amount !== undefined) updateData.amount = body.amount;
      if (body.currency !== undefined) updateData.currency = body.currency;
      if (body.billingCycle !== undefined) updateData.billingCycle = body.billingCycle;
      if (body.autoRenew !== undefined) updateData.autoRenew = body.autoRenew;

      if (Object.keys(updateData).length === 0) {
        set.status = 400;
        return { error: "No fields to update" };
      }

      await db
        .update(schema.recurringIncome)
        .set(updateData)
        .where(and(eq(schema.recurringIncome.id, id), eq(schema.recurringIncome.userId, user.id)));

      const [updated] = await db
        .select()
        .from(schema.recurringIncome)
        .where(eq(schema.recurringIncome.id, id));

      return { data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        categoryId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        amount: t.Optional(t.String({ pattern: amountPattern })),
        currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        billingCycle: t.Optional(
          t.Union([
            t.Literal("weekly"),
            t.Literal("fortnightly"),
            t.Literal("monthly"),
            t.Literal("quarterly"),
            t.Literal("yearly"),
          ])
        ),
        autoRenew: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── Archive recurring income (soft delete) ──
  .delete("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.recurringIncome)
      .where(
        and(
          eq(schema.recurringIncome.id, id),
          eq(schema.recurringIncome.userId, user.id),
          isNull(schema.recurringIncome.archivedAt)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Recurring income not found" };
    }

    await db
      .update(schema.recurringIncome)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.recurringIncome.id, id), eq(schema.recurringIncome.userId, user.id)));

    return { data: { message: "Recurring income archived" } };
  }, {
    params: t.Object({ id: t.String() }),
  });
