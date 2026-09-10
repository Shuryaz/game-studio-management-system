import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../../db";
import { members } from "../../db/schema/member";
import { users } from "../../db/schema/user";
import { roles } from "../../db/schema/role";
import { projectMembers } from "../../db/schema/project-member";
import { projects } from "../../db/schema/project";
import { bugs } from "../../db/schema/bug";
import { tasks } from "../../db/schema/task";
import { eq, asc, or } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file before starting the server.");
}

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

type Department = "Engineering" | "Art & Design" | "Game Design" | "Production" | "QA" | "Audio";
type MemberStatus = "Active" | "OOO" | "Inactive";

export const teamRoutes = new Elysia({ prefix: "/team" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET! }))

  // ── GET /team ────────────────────────────────────────────────────────────────
  .get("/", async ({ query }) => {
    const { department, search, page = 1, pageSize = 10 } = query;

    // Join members with users and roles
    const all = await db
      .select({
        id:         members.id,
        userId:     members.userId,
        name:       members.name,
        email:      members.email,
        jobTitle:   members.jobTitle,
        department: members.department,
        status:     members.status,
        statusNote: members.statusNote,
        avatarUrl:  members.avatarUrl,
        username:   users.username,
        roleName:   roles.roleName,
      })
      .from(members)
      .leftJoin(users, or(eq(members.userId, users.id), eq(members.email, users.email)))
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .orderBy(asc(members.name));

    const filtered = all.filter((m) => {
      if (department && department !== "All" && m.department !== department) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !m.email.toLowerCase().includes(q) &&
          !(m.jobTitle ?? "").toLowerCase().includes(q) &&
          !(m.username ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    const total = filtered.length;
    const safePage = Math.max(1, Number(page));
    const safeSize = Math.max(1, Number(pageSize));
    const paginated = filtered.slice((safePage - 1) * safeSize, safePage * safeSize);

    // Department counts
    const deptCounts: Record<string, number> = {};
    for (const m of all) {
      deptCounts[m.department] = (deptCounts[m.department] ?? 0) + 1;
    }

    return {
      success: true,
      data: paginated.map((m) => ({
        id:         String(m.id),
        userId:     m.userId ? String(m.userId) : null,
        name:       m.name,
        email:      m.email,
        username:   m.username ?? null,
        jobTitle:   m.jobTitle ?? (m.roleName ? m.roleName.charAt(0).toUpperCase() + m.roleName.slice(1) : null),
        systemRole: m.roleName ?? null,
        department: m.department,
        status:     m.status,
        statusNote: m.statusNote ?? null,
        avatarUrl:  m.avatarUrl ?? null,
      })),
      pagination: {
        page: safePage, pageSize: safeSize, total,
        totalPages: Math.max(1, Math.ceil(total / safeSize)),
      },
      meta: { total: all.length, deptCounts },
    };
  }, {
    query: t.Object({
      department: t.Optional(t.String()),
      search:     t.Optional(t.String()),
      page:       t.Optional(t.Numeric()),
      pageSize:   t.Optional(t.Numeric()),
    }),
  })

  // ── POST /team ───────────────────────────────────────────────────────────────
  .post("/", async ({ body, set }) => {
    const { name, email, jobTitle, department, status, statusNote, username, password, systemRole } = body;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = name.trim();

    // Check duplicate email in members table
    const existingMemberEmail = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.email, cleanEmail))
      .limit(1);

    if (existingMemberEmail[0]) {
      set.status = 409;
      return { success: false, message: "A member with this email address already exists." };
    }

    // 1. Resolve role from roles table
    const targetRoleName = (systemRole || jobTitle || "developer").toLowerCase();
    const roleRows = await db.select().from(roles);
    const targetRole = roleRows.find((r) => r.roleName.toLowerCase() === targetRoleName)
      ?? roleRows.find((r) => r.roleName.toLowerCase() === "developer")
      ?? roleRows[0];

    let createdUserId: number | null = null;

    // 2. If username & password provided (or creating account), register in users table
    if (username && password) {
      const cleanUsername = username.trim();

      // Check username duplicate
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, cleanUsername))
        .limit(1);

      if (existingUser[0]) {
        set.status = 409;
        return { success: false, message: "Username is already taken." };
      }

      // Check email duplicate in users
      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);

      if (existingEmail[0]) {
        set.status = 409;
        return { success: false, message: "Email is already in use by another account." };
      }

      // Hash password and insert into users
      const hashedPassword = await Bun.password.hash(password);
      await db.insert(users).values({
        username: cleanUsername,
        email:    cleanEmail,
        password: hashedPassword,
        roleId:   targetRole ? targetRole.roleId : 1,
      });

      const newUsers = await db.select({ id: users.id }).from(users).where(eq(users.username, cleanUsername)).limit(1);
      if (newUsers[0]) {
        createdUserId = newUsers[0].id;
      }
    } else {
      // Check if user account already exists by email
      const existingUserByEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);
      if (existingUserByEmail[0]) {
        createdUserId = existingUserByEmail[0].id;
      }
    }

    // 3. Create member record in members table
    const displayJobTitle = jobTitle?.trim() || (targetRole ? targetRole.roleName.charAt(0).toUpperCase() + targetRole.roleName.slice(1) : "Developer");

    await db.insert(members).values({
      userId:     createdUserId,
      name:       cleanName,
      email:      cleanEmail,
      jobTitle:   displayJobTitle,
      department: (department as Department) ?? "Engineering",
      status:     (status as MemberStatus) ?? "Active",
      statusNote: statusNote?.trim() || null,
    });

    const created = await db
      .select()
      .from(members)
      .where(eq(members.email, cleanEmail))
      .limit(1);
    const m = created[0]!;

    set.status = 201;
    return {
      success: true,
      data: {
        id:         String(m.id),
        userId:     createdUserId ? String(createdUserId) : null,
        name:       m.name,
        email:      m.email,
        username:   username?.trim() ?? null,
        jobTitle:   m.jobTitle ?? displayJobTitle,
        systemRole: targetRole?.roleName ?? null,
        department: m.department,
        status:     m.status,
        statusNote: m.statusNote ?? null,
        avatarUrl:  null,
      },
    };
  }, {
    body: t.Object({
      name:       t.String(),
      email:      t.String(),
      jobTitle:   t.Optional(t.Nullable(t.String())),
      department: t.Optional(t.Nullable(t.String())),
      status:     t.Optional(t.Nullable(t.String())),
      statusNote: t.Optional(t.Nullable(t.String())),
      username:   t.Optional(t.Nullable(t.String())),
      password:   t.Optional(t.Nullable(t.String())),
      systemRole: t.Optional(t.Nullable(t.String())),
    }),
  })

  // ── PUT /team/:id ────────────────────────────────────────────────────────────
  .put("/:id", async ({ params, body }) => {
    const memberId = Number(params.id);
    const existingMembers = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
    const member = existingMembers[0];

    if (!member) {
      return { success: false, message: "Member not found" };
    }

    const cleanEmail = body.email?.trim().toLowerCase();

    await db.update(members).set({
      name:       body.name?.trim()       ?? undefined,
      email:      cleanEmail              ?? undefined,
      jobTitle:   body.jobTitle?.trim()   ?? undefined,
      department: body.department as Department | undefined,
      status:     body.status     as MemberStatus | undefined,
      statusNote: body.statusNote ?? undefined,
    }).where(eq(members.id, memberId));

    // Update corresponding user record if linked
    const targetUserId = member.userId;
    if (targetUserId) {
      const updates: Record<string, unknown> = {};
      if (cleanEmail) updates.email = cleanEmail;

      if (body.systemRole || body.jobTitle) {
        const targetRoleName = (body.systemRole || body.jobTitle || "").toLowerCase();
        const roleRows = await db.select().from(roles);
        const targetRole = roleRows.find((r) => r.roleName.toLowerCase() === targetRoleName);
        if (targetRole) {
          updates.roleId = targetRole.roleId;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, targetUserId));
      }
    }

    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      name:       t.Optional(t.Nullable(t.String())),
      email:      t.Optional(t.Nullable(t.String())),
      jobTitle:   t.Optional(t.Nullable(t.String())),
      department: t.Optional(t.Nullable(t.String())),
      status:     t.Optional(t.Nullable(t.String())),
      statusNote: t.Optional(t.Nullable(t.String())),
      systemRole: t.Optional(t.Nullable(t.String())),
    }),
  })

  // ── DELETE /team/:id ─────────────────────────────────────────────────────────
  .delete("/:id", async ({ params, cookie, jwt, set }) => {
    const tokenValue = cookie.token && typeof cookie.token.value === "string" ? cookie.token.value : undefined;
    const auth = await resolveUser({ token: tokenValue }, jwt);

    const memberId = Number(params.id);
    const rows = await db.select().from(members).where(eq(members.id, memberId));
    const m = rows[0];

    if (!m) {
      set.status = 404;
      return { success: false, message: "Not found" };
    }

    // Determine associated user ID
    let targetUserId: number | null = m.userId ?? null;
    if (!targetUserId && m.email) {
      const u = await db.select({ id: users.id }).from(users).where(eq(users.email, m.email)).limit(1);
      if (u[0]) targetUserId = u[0].id;
    }

    if (targetUserId) {
      // 1. Prevent self-deletion if logged in
      if (auth && auth.userId === targetUserId) {
        set.status = 400;
        return { success: false, message: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif." };
      }

      // 2. Prevent deletion of Admin accounts
      const userRole = await db
        .select({ roleName: roles.roleName })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.roleId))
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (userRole[0] && userRole[0].roleName.trim().toLowerCase() === "admin") {
        set.status = 400;
        return { success: false, message: "Akun Administrator tidak dapat dihapus dari sistem." };
      }

      // 3. Clean up child foreign key references before deleting user
      await db.delete(projectMembers).where(eq(projectMembers.userId, targetUserId));
      await db.update(projects).set({ leadProducerId: null }).where(eq(projects.leadProducerId, targetUserId));
      await db.update(bugs).set({ assigneeId: null, assignee: null }).where(eq(bugs.assigneeId, targetUserId));
      await db.update(tasks).set({ assigneeId: null, assignee: null }).where(eq(tasks.assigneeId, targetUserId));

      // Delete user row
      await db.delete(users).where(eq(users.id, targetUserId));
    }

    // Delete member row
    await db.delete(members).where(eq(members.id, memberId));

    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }) });

