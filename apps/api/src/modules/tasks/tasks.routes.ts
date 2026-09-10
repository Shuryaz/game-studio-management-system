import { Elysia, t } from "elysia";
import { db } from "../../db";
import { tasks } from "../../db/schema/task";
import { eq, asc } from "drizzle-orm";

function makeExternalId() { return `KITS-${Math.floor(1000 + Math.random() * 9000)}`; }

export const taskRoutes = new Elysia({ prefix: "/tasks" })
  .get("/", async ({ query }) => {
    const { page = 1, pageSize = 50 } = query;
    const all = await db.select().from(tasks).orderBy(asc(tasks.createdAt));
    const total = all.length;
    const safePage = Math.max(1, Number(page));
    const safePageSize = Math.max(1, Number(pageSize));
    const paginated = all.slice((safePage - 1) * safePageSize, safePage * safePageSize);
    return { success: true, data: paginated.map((r) => ({ id: String(r.id), externalId: r.externalId, title: r.title, description: r.description ?? null, priority: r.priority, status: r.status, assignee: r.assignee ?? "Unassigned", deadline: r.deadline ?? null })) };
  }, { query: t.Object({ page: t.Optional(t.Numeric()), pageSize: t.Optional(t.Numeric()) }) })

  .post("/", async ({ body, set }) => {
    const { title, description, priority, status, assignee, deadline, projectId } = body;
    const externalId = makeExternalId();
    const result = await db.insert(tasks).values({
      externalId,
      title: title.trim(),
      description: description?.trim() ?? null,
      priority: (priority as "High" | "Medium" | "Low") || "Medium",
      status: (status as "todo" | "in-progress" | "testing" | "done") || "todo",
      assignee: assignee || null,
      deadline: deadline ? String(deadline).slice(0, 10) : null,
      projectId: projectId ? Number(projectId) : null,
    });
    const insertId = Number(result[0].insertId);
    set.status = 201;
    return { success: true, data: { id: String(insertId), externalId } };
  }, { body: t.Object({ title: t.String(), description: t.Optional(t.String()), priority: t.Optional(t.String()), status: t.Optional(t.String()), assignee: t.Optional(t.String()), deadline: t.Optional(t.String()), projectId: t.Optional(t.Numeric()) }) })

  .put("/:id", async ({ params, body, set }) => {
    const id = Number(params.id);
    await db.update(tasks).set({
      title: body.title?.trim() ?? undefined,
      description: body.description ?? undefined,
      priority: (body.priority as "High" | "Medium" | "Low") ?? undefined,
      status: (body.status as "todo" | "in-progress" | "testing" | "done") ?? undefined,
      assignee: body.assignee ?? undefined,
      deadline: body.deadline ? String(body.deadline).slice(0, 10) : undefined,
    }).where(eq(tasks.id, id));
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }), body: t.Object({ title: t.Optional(t.String()), description: t.Optional(t.String()), priority: t.Optional(t.String()), status: t.Optional(t.String()), assignee: t.Optional(t.String()), deadline: t.Optional(t.String()) }) })

  .delete("/:id", async ({ params, set }) => {
    const id = Number(params.id);
    await db.delete(tasks).where(eq(tasks.id, id));
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }) });
