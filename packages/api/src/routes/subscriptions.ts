import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull, lte, gte } from "drizzle-orm";

const amountPattern = "^\\d+(\\.\\d{1,2})?$";
const datePattern = "^\\d{4}-\\d{2}-\\d{2}$";
const httpUrlPattern = "^https?://.+";

export const subscriptionRoutes = new Elysia({
  prefix: "/subscriptions",
  detail: { tags: ["Subscriptions"] },
})
  .use(authMiddleware)
  // ── List subscriptions ──
  .get("/", async ({ user }) => {
    const rows = await db
      .select({
        id: schema.subscriptions.id,
        userId: schema.subscriptions.userId,
        categoryId: schema.subscriptions.categoryId,
        categoryName: schema.categories.name,
        categoryIcon: schema.categories.icon,
        name: schema.subscriptions.name,
        description: schema.subscriptions.description,
        amount: schema.subscriptions.amount,
        currency: schema.subscriptions.currency,
        billingCycle: schema.subscriptions.billingCycle,
        nextRenewalDate: schema.subscriptions.nextRenewalDate,
        startDate: schema.subscriptions.startDate,
        url: schema.subscriptions.url,
        autoRenew: schema.subscriptions.autoRenew,
        createdAt: schema.subscriptions.createdAt,
        updatedAt: schema.subscriptions.updatedAt,
      })
      .from(schema.subscriptions)
      .leftJoin(
        schema.categories,
        eq(schema.subscriptions.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.subscriptions.userId, user.id),
          isNull(schema.subscriptions.archivedAt)
        )
      )
      .orderBy(schema.subscriptions.nextRenewalDate);

    return { data: rows };
  })
  // ── Upcoming renewals ──
  .get("/upcoming", async ({ user, query }) => {
    const days = Number(query.days) || 30;
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toISOString().slice(0, 10);

    const rows = await db
      .select({
        id: schema.subscriptions.id,
        name: schema.subscriptions.name,
        amount: schema.subscriptions.amount,
        currency: schema.subscriptions.currency,
        billingCycle: schema.subscriptions.billingCycle,
        nextRenewalDate: schema.subscriptions.nextRenewalDate,
        categoryName: schema.categories.name,
        categoryIcon: schema.categories.icon,
      })
      .from(schema.subscriptions)
      .leftJoin(
        schema.categories,
        eq(schema.subscriptions.categoryId, schema.categories.id)
      )
      .where(
        and(
          eq(schema.subscriptions.userId, user.id),
          isNull(schema.subscriptions.archivedAt),
          gte(schema.subscriptions.nextRenewalDate, today),
          lte(schema.subscriptions.nextRenewalDate, futureDate)
        )
      )
      .orderBy(schema.subscriptions.nextRenewalDate);

    return { data: rows };
  })
  // ── Create subscription ──
  .post(
    "/",
    async ({ body, user, set }) => {
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
        .insert(schema.subscriptions)
        .values({
          name: body.name,
          description: body.description ?? null,
          amount: body.amount,
          currency: body.currency,
          billingCycle: body.billingCycle,
          nextRenewalDate: body.nextRenewalDate,
          startDate: body.startDate,
          url: body.url ?? null,
          autoRenew: body.autoRenew ?? true,
          userId: user.id,
          categoryId: body.categoryId ?? null,
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, result.id));

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
        nextRenewalDate: t.String({ pattern: datePattern }),
        startDate: t.String({ pattern: datePattern }),
        url: t.Optional(
          t.Nullable(
            t.String({
              pattern: httpUrlPattern,
              maxLength: 500,
              error: "URL must start with http:// or https://",
            })
          )
        ),
        autoRenew: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── Update subscription ──
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);

      const [existing] = await db
        .select()
        .from(schema.subscriptions)
        .where(
          and(
            eq(schema.subscriptions.id, id),
            eq(schema.subscriptions.userId, user.id),
            isNull(schema.subscriptions.archivedAt)
          )
        );

      if (!existing) {
        set.status = 404;
        return { error: "Subscription not found" };
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

      await db
        .update(schema.subscriptions)
        .set(body)
        .where(and(eq(schema.subscriptions.id, id), eq(schema.subscriptions.userId, user.id)));

      const [updated] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, id));

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
        nextRenewalDate: t.Optional(t.String({ pattern: datePattern })),
        startDate: t.Optional(t.String({ pattern: datePattern })),
        url: t.Optional(
          t.Nullable(
            t.String({
              pattern: httpUrlPattern,
              maxLength: 500,
              error: "URL must start with http:// or https://",
            })
          )
        ),
        autoRenew: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── Archive subscription ──
  .delete("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.id, id),
          eq(schema.subscriptions.userId, user.id),
          isNull(schema.subscriptions.archivedAt)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Subscription not found" };
    }

    await db
      .update(schema.subscriptions)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.subscriptions.id, id), eq(schema.subscriptions.userId, user.id)));

    return { data: { message: "Subscription archived" } };
  }, {
    params: t.Object({ id: t.String() }),
  });
