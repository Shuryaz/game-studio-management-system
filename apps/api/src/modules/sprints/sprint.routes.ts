import { Elysia, t } from "elysia";
import { db } from "../../db";
import { sprints } from "../../db/schema/sprint";
import { sprintItems } from "../../db/schema/sprint-item";
import { eq, asc } from "drizzle-orm";

function toDateStr(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export const sprintRoutes = new Elysia({ prefix: "/sprints" })

  // ── GET /sprints ────────────────────────────────────────────────────────────
  .get("/", async ({ query }) => {
    const { page = 1, pageSize = 20 } = query;
    const all = await db.select().from(sprints).orderBy(asc(sprints.createdAt));
    const total = all.length;
    const safePage = Math.max(1, Number(page));
    const safePageSize = Math.max(1, Number(pageSize));
    const paginated = all.slice((safePage - 1) * safePageSize, safePage * safePageSize);

    return {
      success: true,
      data: paginated.map((r) => ({
        id: String(r.id),
        label: r.label,
        startDate: toDateStr(r.startDate),
        endDate: toDateStr(r.endDate),
        status: r.status,
      })),
      pagination: { page: safePage, pageSize: safePageSize, total, totalPages: Math.max(1, Math.ceil(total / safePageSize)) },
    };
  }, { query: t.Object({ page: t.Optional(t.Numeric()), pageSize: t.Optional(t.Numeric()) }) })

  // ── POST /sprints ───────────────────────────────────────────────────────────
  .post("/", async ({ body }) => {
    const { label, startDate, endDate } = body;
    await db.insert(sprints).values({
      label: label.trim(),
      startDate: startDate ? String(startDate).slice(0, 10) : null,
      endDate: endDate ? String(endDate).slice(0, 10) : null,
    });

    const created = await db.select().from(sprints).orderBy(asc(sprints.createdAt));
    const newSprint = created[created.length - 1]!;
    return {
      success: true,
      data: {
        id: String(newSprint.id),
        label: newSprint.label,
        startDate: toDateStr(newSprint.startDate),
        endDate: toDateStr(newSprint.endDate),
        status: newSprint.status,
      },
    };
  }, { body: t.Object({ label: t.String(), startDate: t.Optional(t.String()), endDate: t.Optional(t.String()) }) })

  // ── GET /sprints/:id/items ──────────────────────────────────────────────────
  .get("/:id/items", async ({ params }) => {
    const sprintId = Number(params.id);
    const rows = await db
      .select()
      .from(sprintItems)
      .where(eq(sprintItems.sprintId, sprintId))
      .orderBy(asc(sprintItems.createdAt));

    return {
      success: true,
      data: rows.map((r) => ({
        id: String(r.id),
        externalId: r.externalId,
        title: r.title,
        description: r.description ?? null,
        priority: r.priority,
        status: r.status,
        assignee: r.assignee ?? "Unassigned",
      })),
    };
  }, { params: t.Object({ id: t.Numeric() }) })

  // ── POST /sprints/:id/items ─────────────────────────────────────────────────
  .post("/:id/items", async ({ params, body }) => {
    const sprintId = Number(params.id);
    const { title, description, priority, status, assignee } = body;
    const externalId = `KITS-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.insert(sprintItems).values({
      externalId,
      sprintId,
      title: title.trim(),
      description: description?.trim() ?? null,
      priority: (priority as "High" | "Medium" | "Lo") ?? "Medium",
      status: (status as "todo" | "in-progress" | "testing" | "done") ?? "todo",
      assignee: assignee ?? null,
    });

    const created = await db
      .select()
      .from(sprintItems)
      .where(eq(sprintItems.sprintId, sprintId))
      .orderBy(asc(sprintItems.createdAt));
    const newItem = created[created.length - 1]!;

    return {
      success: true,
      data: {
        id: String(newItem.id),
        externalId: newItem.externalId,
        title: newItem.title,
        description: newItem.description ?? null,
        priority: newItem.priority,
        status: newItem.status,
        assignee: newItem.assignee ?? "Unassigned",
      },
    };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      priority: t.Optional(t.String()),
      status: t.Optional(t.String()),
      assignee: t.Optional(t.String()),
    }),
  })

  // ── PUT /sprints/:id/items/:itemId ──────────────────────────────────────────
  .put("/:id/items/:itemId", async ({ params, body }) => {
    const itemId = Number(params.itemId);
    await db.update(sprintItems).set({
      title: body.title?.trim() ?? undefined,
      description: body.description ?? undefined,
      priority: body.priority as "High" | "Medium" | "Lo" | undefined,
      status: body.status as "todo" | "in-progress" | "testing" | "done" | undefined,
      assignee: body.assignee ?? undefined,
    }).where(eq(sprintItems.id, itemId));
    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric(), itemId: t.Numeric() }),
    body: t.Object({
      title: t.Optional(t.String()),
      description: t.Optional(t.String()),
      priority: t.Optional(t.String()),
      status: t.Optional(t.String()),
      assignee: t.Optional(t.String()),
    }),
  })

  // ── DELETE /sprints/:id/items/:itemId ───────────────────────────────────────
  .delete("/:id/items/:itemId", async ({ params }) => {
    await db.delete(sprintItems).where(eq(sprintItems.id, Number(params.itemId)));
    return { success: true };
  }, { params: t.Object({ id: t.Numeric(), itemId: t.Numeric() }) })

  // ── DELETE /sprints/:id ─────────────────────────────────────────────────────
  .delete("/:id", async ({ params }) => {
    // sprint_items rows are cascade-deleted by the FK on sprint_id
    await db.delete(sprints).where(eq(sprints.id, Number(params.id)));
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }) });
