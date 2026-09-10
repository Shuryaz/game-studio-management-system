import { Elysia, t } from "elysia";
import { db } from "../../db";
import { bugs } from "../../db/schema/bug";
import { eq, desc } from "drizzle-orm";
import { join } from "path";
import { writeFile, unlink, mkdir } from "fs/promises";

import { validateBugEvidenceFile } from "../../utils/file-security";

const EVIDENCE_DIR = "C:/Users/ArkTsuruya/Documents/PROJECT/BUG_REPORTS";

function toIsoString(val: any): string {
  if (!val) return new Date().toISOString();
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return new Date().toISOString();
  const diff = Date.now() - d.getTime();
  if (diff < -60000) {
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    return new Date(d.getTime() + tzOffsetMs).toISOString();
  }
  return d.toISOString();
}

export const bugRoutes = new Elysia({ prefix: "/bugs" })

  // ── GET /bugs ────────────────────────────────────────────────────────────────
  .get("/", async ({ query }) => {
    const { status, severity, project, search, page = 1, pageSize = 50 } = query;

    const all = await db.select().from(bugs).orderBy(desc(bugs.createdAt));

    const filtered = all.filter((b) => {
      if (status   && status   !== "All Statuses"   && b.status   !== status)   return false;
      if (severity && severity !== "All Severities" && b.severity !== severity) return false;
      if (project  && project  !== "All Projects"   && b.project  !== project)  return false;
      if (search) {
        const q = search.toLowerCase();
        if (!b.title.toLowerCase().includes(q) && !String(b.id).includes(q)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const safePage = Math.max(1, Number(page));
    const safeSize = Math.max(1, Number(pageSize));
    const paginated = filtered.slice((safePage - 1) * safeSize, safePage * safeSize);
    const projects = Array.from(new Set(all.map((b) => b.project).filter(Boolean))) as string[];

    return {
      success: true,
      data: paginated.map((b) => ({
        id:           String(b.id),
        title:        b.title,
        description:  b.description ?? null,
        steps:        b.steps ?? null,
        severity:     b.severity,
        priority:     b.priority,
        status:       b.status,
        project:      b.project ?? null,
        assignee:     b.assignee ?? null,
        reportedBy:   b.reportedBy ?? null,
        evidenceFile: b.evidenceFile ?? null,
        createdAt:    toIsoString(b.createdAt),
      })),
      pagination: { page: safePage, pageSize: safeSize, total, totalPages: Math.max(1, Math.ceil(total / safeSize)) },
      meta: { projects, openCount: all.filter((b) => b.status === "Open").length },
    };
  }, {
    query: t.Object({
      status:   t.Optional(t.String()),
      severity: t.Optional(t.String()),
      project:  t.Optional(t.String()),
      search:   t.Optional(t.String()),
      page:     t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
    }),
  })

  // ── GET /bugs/count ──────────────────────────────────────────────────────────
  .get("/count", async () => {
    const all = await db.select().from(bugs);
    return { success: true, data: { open: all.filter((b) => b.status === "Open").length, total: all.length } };
  })

  // ── POST /bugs (multipart — evidence file optional) ──────────────────────────
  .post("/", async ({ body, set }) => {
    const { title, description, steps, severity, priority, project, assignee, reportedBy, evidence } = body;

    let evidencePath: string | null = null;
    let evidenceFileName: string | null = null;

    if (evidence && evidence.size > 0) {
      const validation = validateBugEvidenceFile(evidence);
      if (!validation.valid) {
        set.status = 400;
        return { success: false, message: validation.error };
      }
      await mkdir(EVIDENCE_DIR, { recursive: true });
      const timestamp = Date.now();
      const safeName = evidence.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      evidenceFileName = `${timestamp}_${safeName}`;
      evidencePath = join(EVIDENCE_DIR, evidenceFileName).replace(/\\/g, "/");
      const buf = await evidence.arrayBuffer();
      await writeFile(evidencePath, Buffer.from(buf));
    }

    const now = new Date();
    await db.insert(bugs).values({
      title: title.trim(),
      description: description?.trim() ?? null,
      steps: steps?.trim() ?? null,
      severity: (severity as "Critical" | "High" | "Medium" | "Low") ?? "Medium",
      priority: priority ?? "P2 - Backlog",
      status: "Open",
      project: project?.trim() || null,
      assignee: assignee?.trim() || null,
      reportedBy: reportedBy?.trim() || null,
      evidencePath,
      evidenceFile: evidenceFileName,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db.select().from(bugs).orderBy(desc(bugs.createdAt));
    const newBug = created[0]!;

    set.status = 201;
    return {
      success: true,
      data: {
        id:           String(newBug.id),
        title:        newBug.title,
        severity:     newBug.severity,
        priority:     newBug.priority,
        status:       newBug.status,
        project:      newBug.project ?? null,
        assignee:     newBug.assignee ?? null,
        reportedBy:   newBug.reportedBy ?? null,
        evidenceFile: newBug.evidenceFile ?? null,
        createdAt:    toIsoString(newBug.createdAt),
      },
    };
  }, {
    body: t.Object({
      title:       t.String(),
      description: t.Optional(t.String()),
      steps:       t.Optional(t.String()),
      severity:    t.Optional(t.String()),
      priority:    t.Optional(t.String()),
      project:     t.Optional(t.String()),
      assignee:    t.Optional(t.String()),
      reportedBy:  t.Optional(t.String()),
      evidence:    t.Optional(t.File()),
    }),
  })

  // ── PUT /bugs/:id ────────────────────────────────────────────────────────────
  .put("/:id", async ({ params, body }) => {
    const id = Number(params.id);
    await db.update(bugs).set({
      title:       body.title?.trim()    ?? undefined,
      description: body.description      ?? undefined,
      steps:       body.steps            ?? undefined,
      severity:    body.severity as "Critical" | "High" | "Medium" | "Low" | undefined,
      priority:    body.priority         ?? undefined,
      status:      body.status as "Open" | "In Progress" | "Resolved" | undefined,
      project:     body.project?.trim()  ?? undefined,
      assignee:    body.assignee?.trim() ?? undefined,
    }).where(eq(bugs.id, id));
    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      title:       t.Optional(t.String()),
      description: t.Optional(t.String()),
      steps:       t.Optional(t.String()),
      severity:    t.Optional(t.String()),
      priority:    t.Optional(t.String()),
      status:      t.Optional(t.String()),
      project:     t.Optional(t.String()),
      assignee:    t.Optional(t.String()),
    }),
  })

  // ── DELETE /bugs/:id ─────────────────────────────────────────────────────────
  .delete("/:id", async ({ params, set }) => {
    const id = Number(params.id);
    const rows = await db.select().from(bugs).where(eq(bugs.id, id));
    if (!rows.length) { set.status = 404; return { success: false, message: "Not found" }; }
    // Delete evidence file if present
    if (rows[0]!.evidencePath) await unlink(rows[0]!.evidencePath).catch(() => {});
    await db.delete(bugs).where(eq(bugs.id, id));
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }) });
