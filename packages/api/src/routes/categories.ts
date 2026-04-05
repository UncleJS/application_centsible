import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { db, schema } from "../db";
import { eq, and, isNull } from "drizzle-orm";

const hexColorPattern = "^#[0-9a-fA-F]{6}$";

export const categoryRoutes = new Elysia({
  prefix: "/categories",
  detail: { tags: ["Categories"] },
})
  .use(authMiddleware)
  // ── List categories ──
  .get("/", async ({ user }) => {
    const rows = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, user.id),
          isNull(schema.categories.archivedAt)
        )
      )
      .orderBy(schema.categories.name);

    return { data: rows };
  })
  // ── Create category ──
  .post(
    "/",
    async ({ body, user, set }) => {
      // Check for duplicate category name for this user
      const [duplicate] = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.userId, user.id),
            eq(schema.categories.name, body.name),
            eq(schema.categories.type, body.type),
            isNull(schema.categories.archivedAt)
          )
        )
        .limit(1);

      if (duplicate) {
        set.status = 409;
        return { error: `A ${body.type} category named "${body.name}" already exists` };
      }

      const [result] = await db
        .insert(schema.categories)
        .values({
          name: body.name,
          icon: body.icon ?? null,
          color: body.color ?? null,
          type: body.type,
          userId: user.id,
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, result.id));

      set.status = 201;
      return { data: created };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 50 }),
        icon: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
        color: t.Optional(
          t.Nullable(t.String({ pattern: hexColorPattern, error: "Color must be hex format #RRGGBB" }))
        ),
        type: t.Union([t.Literal("income"), t.Literal("expense")]),
      }),
    }
  )
  // ── Update category (type change not allowed) ──
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);

      const [existing] = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, id),
            eq(schema.categories.userId, user.id),
            isNull(schema.categories.archivedAt)
          )
        );

      if (!existing) {
        set.status = 404;
        return { error: "Category not found" };
      }

      const updateData: Partial<typeof body> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.color !== undefined) updateData.color = body.color;

      if (Object.keys(updateData).length === 0) {
        set.status = 400;
        return { error: "No fields to update" };
      }

      await db
        .update(schema.categories)
        .set(updateData)
        .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, user.id)));

      const [updated] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, id));

      return { data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        icon: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
        color: t.Optional(
          t.Nullable(t.String({ pattern: hexColorPattern, error: "Color must be hex format #RRGGBB" }))
        ),
        // type intentionally excluded — cannot change category type after creation
      }),
    }
  )
  // ── Archive category (soft-delete) ──
  .delete("/:id", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.userId, user.id),
          isNull(schema.categories.archivedAt)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Category not found" };
    }

    await db
      .update(schema.categories)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, user.id)));

    return { data: { message: "Category archived" } };
  }, {
    params: t.Object({ id: t.String() }),
  })
  // ── Restore category ──
  .post("/:id/restore", async ({ params, user, set }) => {
    const id = Number(params.id);

    const [existing] = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.userId, user.id)
        )
      );

    if (!existing) {
      set.status = 404;
      return { error: "Category not found" };
    }

    if (!existing.archivedAt) {
      set.status = 400;
      return { error: "Category is not archived" };
    }

    await db
      .update(schema.categories)
      .set({ archivedAt: null })
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, user.id)));

    const [restored] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, id));

    return { data: restored };
  }, {
    params: t.Object({ id: t.String() }),
  });
