import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../../db";
import { projects } from "../../db/schema/project";
import { users } from "../../db/schema/user";
import { projectMembers } from "../../db/schema/project-member";
import { members } from "../../db/schema/member";
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
  const sub = payload ? payload.sub : undefined;

  if (typeof sub !== "string" && typeof sub !== "number") return null;

  return { userId: Number(sub) };
}
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
          leadProducerId: projects.leadProducerId,
          leadProducerUsername: users.username,
          leadProducerMemberName: members.name,
        })
        .from(projects)
        .leftJoin(users, eq(projects.leadProducerId, users.id))
        .leftJoin(members, eq(users.email, members.email))
        .where(whereClause)
        .orderBy(asc(projects.createdAt));

      // Fetch all project members to resolve assigned member fallback
      const allProjectMembers = await db
        .select({
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          projectRole: projectMembers.projectRole,
          username: users.username,
          memberName: members.name,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .leftJoin(members, eq(users.email, members.email));

      const memberMap = new Map<number, { name: string; role: string }[]>();
      for (const pm of allProjectMembers) {
        const list = memberMap.get(pm.projectId) ?? [];
        list.push({ name: pm.memberName || pm.username, role: pm.projectRole });
        memberMap.set(pm.projectId, list);
      }

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
          let resolvedLeadName = row.leadProducerMemberName || row.leadProducerUsername || null;

          if (!resolvedLeadName) {
            const pMembers = memberMap.get(row.id) ?? [];
            const lead = pMembers.find((m) => m.role.toLowerCase().includes("producer") || m.role.toLowerCase().includes("lead")) ?? pMembers[0];
            if (lead) resolvedLeadName = lead.name;
          }

          const finalName = resolvedLeadName || "Unassigned";
          const nameParts = finalName.split(" ").filter(Boolean);
          const initials =
            nameParts.length >= 2
              ? `${nameParts[0]?.[0] ?? ""}${nameParts[nameParts.length - 1]?.[0] ?? ""}`.toUpperCase()
              : finalName.slice(0, 2).toUpperCase();

          return {
            id: String(row.id),
            name: row.name,
            status: row.status,
            deadline: row.targetDate ?? null,
            leadProducer: {
              name: finalName,
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
      const tokenValue = cookie.token && typeof cookie.token.value === "string" ? cookie.token.value : undefined;
      const auth = await resolveUser({ token: tokenValue }, jwt);

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

      const targetDate = deadline ? String(deadline).slice(0, 10) : null;

      const result = await db.insert(projects).values({
        name: name.trim(),
        description: description?.trim() ?? null,
        genre: genre?.trim() || null,
        platform: platforms?.length ? platforms.join(",") : null,
        status: "Pre-production",
        targetDate,
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
          memberName:  members.name,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .leftJoin(members, eq(users.email, members.email))
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
        const parts = name.split(" ").filter(Boolean);
        return parts.length >= 2
          ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase()
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
          createdAt:   toIsoString(row.createdAt),
          progress:    statusProgressMap[row.status] ?? 0,
          leadProducer: row.leadProducerName
            ? {
                name:     row.leadProducerName,
                initials: toInitials(row.leadProducerName),
                avatar:   "",
              }
            : null,
          members: memberRows.map((m) => {
            const displayName = m.memberName || m.username;
            return {
              userId:      m.userId,
              username:    displayName,
              projectRole: m.projectRole,
              initials:    toInitials(displayName),
              avatar:      "",
            };
          }),
          timeline: {
            stages: stages.map((stage) => {
              const stageStatusMap: Record<string, string> = {
                Concept: "Pre-production",
                Alpha:   "Alpha",
                Beta:    "Beta",
                Gold:    "Live",
              };
              const mappedStatus = stageStatusMap[stage] ?? "Pre-production";
              const stageStatusOrder = stageOrder.indexOf(mappedStatus);
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

  // ── PUT /projects/:id ───────────────────────────────────────────────────────
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const projectId = Number(params.id);
      const { name, status, description, genre, deadline } = body;

      const existing = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!existing[0]) {
        set.status = 404;
        return { success: false, message: "Project not found." };
      }

      const now = new Date();
      await db
        .update(projects)
        .set({
          name: name?.trim() ?? undefined,
          status: status as "Alpha" | "Beta" | "Pre-production" | "Live" | "Cancelled" | undefined,
          description: description?.trim() ?? undefined,
          genre: genre?.trim() ?? undefined,
          targetDate: deadline ? String(deadline).slice(0, 10) : undefined,
          updatedAt: now,
          createdAt: now, // update timestamp for recent activity ordering
        })
        .where(eq(projects.id, projectId));

      return { success: true, message: "Project updated successfully." };
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        name: t.Optional(t.String()),
        status: t.Optional(t.String()),
        description: t.Optional(t.String()),
        genre: t.Optional(t.String()),
        deadline: t.Optional(t.String()),
      }),
    }
  )

  // ── POST /projects/:id/members ─────────────────────────────────────────────
  .post(
    "/:id/members",
    async ({ params, body, set }) => {
      const projectId = Number(params.id);
      const { userId, email, projectRole } = body;

      const projectRows = await db
        .select({ id: projects.id, leadProducerId: projects.leadProducerId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!projectRows[0]) {
        set.status = 404;
        return { success: false, message: "Project not found." };
      }

      let targetUserId = userId;
      const cleanEmail = email ? email.trim().toLowerCase() : "";

      if (!targetUserId && cleanEmail) {
        const userRows = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, cleanEmail))
          .limit(1);

        if (userRows[0]) {
          targetUserId = userRows[0].id;
        } else {
          // Find member details to auto-create user account if missing
          const memberRows = await db
            .select()
            .from(members)
            .where(eq(members.email, cleanEmail))
            .limit(1);

          if (memberRows[0]) {
            const m = memberRows[0];
            const baseUsername = m.name.toLowerCase().replace(/[^a-z0-9]/g, ".");
            const hashedPassword = await Bun.password.hash("default123");
            await db.insert(users).values({
              username: baseUsername || cleanEmail.split("@")[0] || "user",
              email: cleanEmail,
              password: hashedPassword,
              roleId: 3, // developer role
            });
            const createdUsers = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, cleanEmail))
              .limit(1);
            if (createdUsers[0]) {
              targetUserId = createdUsers[0].id;
              // Also update members.userId link
              await db.update(members).set({ userId: targetUserId }).where(eq(members.id, m.id));
            }
          }
        }
      }

      if (!targetUserId) {
        set.status = 400;
        return { success: false, message: "Could not resolve user account for this team member." };
      }

      // If project has no leadProducerId set, or if role is Producer/Lead, set projects.leadProducerId
      if (!projectRows[0].leadProducerId || projectRole.toLowerCase().includes("producer") || projectRole.toLowerCase().includes("lead")) {
        await db.update(projects).set({ leadProducerId: targetUserId }).where(eq(projects.id, projectId));
      }

      // Insert or update projectMember
      const existing = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)))
        .limit(1);

      if (existing[0]) {
        await db
          .update(projectMembers)
          .set({ projectRole: projectRole.trim() })
          .where(eq(projectMembers.id, existing[0].id));
      } else {
        await db.insert(projectMembers).values({
          projectId,
          userId: targetUserId,
          projectRole: projectRole.trim(),
        });
      }

      return { success: true, message: "Member added to project successfully." };
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        userId:      t.Optional(t.Numeric()),
        email:       t.Optional(t.String()),
        projectRole: t.String({ minLength: 1 }),
      }),
    }
  )

  // ── DELETE /projects/:id ───────────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ params, cookie, jwt, set }) => {
      // ── Auth: read JWT from httpOnly cookie ───────────────────────────────
      const tokenValue = cookie.token && typeof cookie.token.value === "string" ? cookie.token.value : undefined;
      const auth = await resolveUser({ token: tokenValue }, jwt);

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
