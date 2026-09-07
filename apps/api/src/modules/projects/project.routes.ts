import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../../db";
import { projects } from "../../db/schema/project";
import { users } from "../../db/schema/user";
import { projectMembers } from "../../db/schema/project-member";
import { eq, like, and, SQL, asc } from "drizzle-orm";

// ─── JWT secret guard ─────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file before starting the server.");
}

// ─── Shared auth helper ───────────────────────────────────────────────────────
// Reads the JWT from the httpOnly cookie set at login.
async function resolveUser(
  cookies: Record<string, string | undefined>,
  jwtPlugin: { verify: (token: string) => Promise<Record<string, unknown> | false> }
): Promise<{ userId: number } | null> {
  const token = cookies["token"];
  if (!token) return null;

  const payload = await jwtPlugin.verify(token);
  if (!payload || !payload.sub) return null;

  return { userId: Number(payload.sub) };
}
// ──────────────────────────────────────────────────────────────────────────────

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET! }))

  // ── GET /projects ──────────────────────────────────────────────────────────
  .get(
    "/",
    async ({ query }) => {
      const { search, status, page = 1, pageSize = 10 } = query;

      const conditions: SQL[] = [];

      if (search) {
        conditions.push(like(projects.name, `%${search}%`));
      }

      if (status && status !== "All") {
        conditions.push(
          eq(projects.status, status as typeof projects.status._.data)
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const allRows = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          targetDate: projects.targetDate,
          createdAt: projects.createdAt,
          leadProducerName: users.username,
        })
        .from(projects)
        .leftJoin(users, eq(projects.leadProducerId, users.id))
        .where(whereClause)
        .orderBy(asc(projects.createdAt));

      const total = allRows.length;
      const safePage = Math.max(1, Number(page));
      const safePageSize = Math.max(1, Number(pageSize));
      const paginated = allRows.slice(
        (safePage - 1) * safePageSize,
        safePage * safePageSize
      );

      return {
        success: true,
        data: paginated.map((row) => {
          const nameParts = (row.leadProducerName ?? "").split(" ");
          const initials =
            nameParts.length >= 2
              ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
              : (row.leadProducerName ?? "?").slice(0, 2).toUpperCase();

          return {
            id: String(row.id),
            name: row.name,
            status: row.status,
            deadline: row.targetDate ?? null,
            leadProducer: {
              name: row.leadProducerName ?? "Unassigned",
              avatar: "",
              initials,
            },
          };
        }),
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / safePageSize)),
        },
      };
    },
    {
      query: t.Object({
        search:   t.Optional(t.String()),
        status:   t.Optional(t.String()),
        page:     t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
    }
  )

  // ── POST /projects ─────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, cookie, jwt, set }) => {
      // ── Auth: read JWT from httpOnly cookie ───────────────────────────────
      const auth = await resolveUser(
        { token: cookie.token?.value },
        jwt
      );

      if (!auth) {
        set.status = 401;
        return { success: false, message: "Unauthorized. Please log in." };
      }

      // ── Verify the user still exists ──────────────────────────────────────
      const userRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1);

      if (!userRows[0]) {
        set.status = 401;
        return { success: false, message: "Unauthorized. User not found." };
      }

      // ── Insert project ────────────────────────────────────────────────────
      const { name, genre, deadline, platforms, description } = body;

      const result = await db.insert(projects).values({
        name: name.trim(),
        description: description?.trim() ?? null,
        genre: genre?.trim() || null,
        platform: platforms?.length ? platforms.join(",") : null,
        status: "Pre-production",
        targetDate: deadline || null,
        createdBy: auth.userId,
        leadProducerId: null,
      });

      const insertId = Number(result[0].insertId);

      set.status = 201;
      return {
        success: true,
        message: "Project created successfully.",
        data: { id: insertId, name: name.trim(), status: "Pre-production" },
      };
    },
    {
      body: t.Object({
        name:        t.String({ minLength: 1, maxLength: 150 }),
        description: t.Optional(t.String()),
        genre:       t.Optional(t.String()),
        deadline:    t.Optional(t.String()),
        platforms:   t.Optional(t.Array(t.String())),
      }),
    }
  )

  // ── GET /projects/:id ─────────────────────────────────────────────────────
  .get(
    "/:id",
    async ({ params, set }) => {
      const projectId = Number(params.id);

      // ── Fetch project + lead producer ─────────────────────────────────────
      const rows = await db
        .select({
          id:              projects.id,
          name:            projects.name,
          description:     projects.description,
          genre:           projects.genre,
          platform:        projects.platform,
          status:          projects.status,
          startDate:       projects.startDate,
          targetDate:      projects.targetDate,
          createdAt:       projects.createdAt,
          leadProducerName: users.username,
        })
        .from(projects)
        .leftJoin(users, eq(projects.leadProducerId, users.id))
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!rows[0]) {
        set.status = 404;
        return { success: false, message: "Project not found." };
      }

      const row = rows[0];

      // ── Fetch project members ─────────────────────────────────────────────
      const memberRows = await db
        .select({
          userId:      projectMembers.userId,
          projectRole: projectMembers.projectRole,
          username:    users.username,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, projectId))
        .orderBy(asc(projectMembers.joinedAt));

      // ── Compute progress based on status ──────────────────────────────────
      const statusProgressMap: Record<string, number> = {
        "Pre-production": 0,
        "Alpha":          25,
        "Beta":           50,
        "Live":           100,
        "Cancelled":      0,
      };

      // ── Production timeline stages ────────────────────────────────────────
      const stages = ["Concept", "Alpha", "Beta", "Gold"] as const;
      const stageOrder = ["Pre-production", "Alpha", "Beta", "Live", "Cancelled"];
      const currentStageIndex = stageOrder.indexOf(row.status);

      // Map status to timeline stage
      const statusToStage: Record<string, string> = {
        "Pre-production": "Concept",
        "Alpha":          "Alpha",
        "Beta":           "Beta",
        "Live":           "Gold",
        "Cancelled":      "Concept",
      };
      const currentTimelineStage = statusToStage[row.status] ?? "Concept";

      // ── Format helpers ────────────────────────────────────────────────────
      function toInitials(name: string) {
        const parts = name.split(" ");
        return parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase();
      }

      const platforms = row.platform
        ? row.platform.split(",").map((p) => p.trim()).filter(Boolean)
        : [];

      return {
        success: true,
        data: {
          id:          String(row.id),
          name:        row.name,
          description: row.description ?? null,
          genre:       row.genre ?? null,
          platforms,
          status:      row.status,
          startDate:   row.startDate ?? null,
          deadline:    row.targetDate ?? null,
          createdAt:   row.createdAt,
          progress:    statusProgressMap[row.status] ?? 0,
          leadProducer: row.leadProducerName
            ? {
                name:     row.leadProducerName,
                initials: toInitials(row.leadProducerName),
                avatar:   "",
              }
            : null,
          members: memberRows.map((m) => ({
            userId:      m.userId,
            username:    m.username,
            projectRole: m.projectRole,
            initials:    toInitials(m.username),
            avatar:      "",
          })),
          timeline: {
            stages: stages.map((stage) => {
              const stageStatusMap: Record<string, string> = {
                Concept: "Pre-production",
                Alpha:   "Alpha",
                Beta:    "Beta",
                Gold:    "Live",
              };
              const stageStatusOrder = stageOrder.indexOf(stageStatusMap[stage]);
              const isDone    = stageStatusOrder < currentStageIndex;
              const isCurrent = stage === currentTimelineStage;
              return { name: stage, done: isDone, current: isCurrent };
            }),
          },
        },
      };
    },
    {
      params: t.Object({ id: t.Numeric() }),
    }
  )

  // ── DELETE /projects/:id ───────────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ params, cookie, jwt, set }) => {
      // ── Auth: read JWT from httpOnly cookie ───────────────────────────────
      const auth = await resolveUser(
        { token: cookie.token?.value },
        jwt
      );

      if (!auth) {
        set.status = 401;
        return { success: false, message: "Unauthorized. Please log in." };
      }

      // ── Check project exists ──────────────────────────────────────────────
      const projectId = Number(params.id);
      const existing = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!existing[0]) {
        set.status = 404;
        return { success: false, message: "Project not found." };
      }

      // ── Delete ────────────────────────────────────────────────────────────
      await db.delete(projects).where(eq(projects.id, projectId));

      return {
        success: true,
        message: `Project "${existing[0].name}" has been deleted.`,
      };
    },
    {
      params: t.Object({ id: t.Numeric() }),
    }
  );
