import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull, sql } from "drizzle-orm";

const amountPattern = "^\\d+(\\.\\d{1,2})?$";
const datePattern = "^\\d{4}-\\d{2}-\\d{2}$";

export const savingsGoalRoutes = new Elysia({
  prefix: "/savings-goals",
  detail: { tags: ["Savings Goals"] },
})
  .use(authMiddleware)
  // ── List savings goals ──
  .get("/", async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.userId, user.id),
          isNull(schema.savingsGoals.archivedAt)
        )
      )
      .orderBy(schema.savingsGoals.targetDate);

    return { data: rows };
  })
  // ── Get single savings goal with contributions ──
  .get("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [goal] = await db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.id, id),
          eq(schema.savingsGoals.userId, user.id),
          isNull(schema.savingsGoals.archivedAt)
        )
      );

    if (!goal) {
      set.status = 404;
      return { error: "Savings goal not found" };
    }

    const contributions = await db
      .select()
      .from(schema.savingsContributions)
      .where(
        and(
          eq(schema.savingsContributions.savingsGoalId, id),
          isNull(schema.savingsContributions.archivedAt)
        )
      )
      .orderBy(schema.savingsContributions.date);

    return { data: { ...goal, contributions } };
  }, {
    params: t.Object({ id: t.String() }),
  })
  // ── Create savings goal ──
  .post(
    "/",
    async ({ body, user, set }) => {
      const [result] = await db
        .insert(schema.savingsGoals)
        .values({
          name: body.name,
          description: body.description ?? null,
          targetAmount: body.targetAmount,
          currency: body.currency,
          targetDate: body.targetDate,
          icon: body.icon ?? null,
          userId: user.id,
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(schema.savingsGoals)
        .where(eq(schema.savingsGoals.id, result.id));

      set.status = 201;
      return { data: created };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        targetAmount: t.String({ pattern: amountPattern, error: "Amount must be a valid decimal" }),
        currency: t.String({ minLength: 3, maxLength: 3 }),
        targetDate: t.String({ pattern: datePattern, error: "Date must be YYYY-MM-DD format" }),
        icon: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
      }),
    }
  )
  // ── Update savings goal ──
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);

      const [existing] = await db
        .select()
        .from(schema.savingsGoals)
        .where(
          and(
            eq(schema.savingsGoals.id, id),
            eq(schema.savingsGoals.userId, user.id),
            isNull(schema.savingsGoals.archivedAt)
          )
        );

      if (!existing) {
        set.status = 404;
        return { error: "Savings goal not found" };
      }

      const updateData: Partial<typeof body> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.targetAmount !== undefined) updateData.targetAmount = body.targetAmount;
      if (body.currency !== undefined) updateData.currency = body.currency;
      if (body.targetDate !== undefined) updateData.targetDate = body.targetDate;
      if (body.icon !== undefined) updateData.icon = body.icon;

      if (Object.keys(updateData).length === 0) {
        set.status = 400;
        return { error: "No fields to update" };
      }

      await db
        .update(schema.savingsGoals)
        .set(updateData)
        .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, user.id)));

      const [updated] = await db
        .select()
        .from(schema.savingsGoals)
        .where(eq(schema.savingsGoals.id, id));

      return { data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        targetAmount: t.Optional(t.String({ pattern: amountPattern })),
        currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        targetDate: t.Optional(t.String({ pattern: datePattern })),
        icon: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
      }),
    }
  )
  // ── Add contribution ──
  .post(
    "/:id/contribute",
    async ({ params, body, user, set }) => {
      const goalId = Number(params.id);

      const [goal] = await db
        .select()
        .from(schema.savingsGoals)
        .where(
          and(
            eq(schema.savingsGoals.id, goalId),
            eq(schema.savingsGoals.userId, user.id),
            isNull(schema.savingsGoals.archivedAt)
          )
        );

      if (!goal) {
        set.status = 404;
        return { error: "Savings goal not found" };
      }

      const contributionDate =
        body.date || new Date().toISOString().slice(0, 10);

      const [result] = await db
        .insert(schema.savingsContributions)
        .values({
          savingsGoalId: goalId,
          amount: body.amount,
          currency: body.currency,
          note: body.note ?? null,
          date: contributionDate,
        })
        .$returningId();

      // Atomic update of current_amount using SQL arithmetic (avoids race condition)
      await db
        .update(schema.savingsGoals)
        .set({
          currentAmount: sql`CAST(${schema.savingsGoals.currentAmount} + ${body.amount} AS DECIMAL(12,2))`,
        })
        .where(and(eq(schema.savingsGoals.id, goalId), eq(schema.savingsGoals.userId, user.id)));

      const [contribution] = await db
        .select()
        .from(schema.savingsContributions)
        .where(eq(schema.savingsContributions.id, result.id));

      set.status = 201;
      return { data: contribution };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        amount: t.String({ pattern: amountPattern, error: "Amount must be a valid decimal" }),
        currency: t.String({ minLength: 3, maxLength: 3 }),
        note: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
        date: t.Optional(t.String({ pattern: datePattern })),
      }),
    }
  )
  // ── Archive savings goal ──
  .delete("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.id, id),
          eq(schema.savingsGoals.userId, user.id),
          isNull(schema.savingsGoals.archivedAt)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Savings goal not found" };
    }

    await db
      .update(schema.savingsGoals)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, user.id)));

    return { data: { message: "Savings goal archived" } };
  }, {
    params: t.Object({ id: t.String() }),
  });
