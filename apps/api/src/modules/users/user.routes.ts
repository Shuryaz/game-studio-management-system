import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../../db";
import { users } from "../../db/schema/user";
import { roles } from "../../db/schema/role";
import { eq, and, ne, asc } from "drizzle-orm";

// ─── JWT secret guard ─────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file before starting the server.");
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function resolveUser(
  cookies: Record<string, string | undefined>,
  jwtPlugin: { verify: (token: string) => Promise<Record<string, unknown> | false> }
): Promise<{ userId: number } | null> {
  const token = cookies["token"];
  if (!token) return null;

  const payload = await jwtPlugin.verify(token);
  const sub = payload && payload.sub;

  if (typeof sub !== "string" && typeof sub !== "number") return null;

  return { userId: Number(sub) };
}
// ──────────────────────────────────────────────────────────────────────────────

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET! }))

  // ── GET /users ─────────────────────────────────────────────────────────────
  .get("/", async () => {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        roleName: roles.roleName,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.roleId))
      .orderBy(asc(users.username));

    return {
      success: true,
      data: rows.map((row) => ({
        id: String(row.id),
        username: row.username,
        email: row.email,
        role: row.roleName?.trim().toLowerCase() ?? "member",
      })),
    };
  })

  // ── GET /users/me ──────────────────────────────────────────────────────────
  .get("/me", async ({ cookie, jwt, set }) => {
    const tokenValue = cookie.token && typeof cookie.token.value === "string" ? cookie.token.value : undefined;
    const auth = await resolveUser({ token: tokenValue }, jwt);

    if (!auth) {
      set.status = 401;
      return { success: false, message: "Unauthorized. Please log in." };
    }

    const result = await db
      .select({
        id:       users.id,
        username: users.username,
        email:    users.email,
        roleName: roles.roleName,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.id, auth.userId))
      .limit(1);

    const user = result[0];

    if (!user) {
      set.status = 404;
      return { success: false, message: "User not found." };
    }

    return {
      success: true,
      data: {
        id:       user.id,
        username: user.username,
        email:    user.email,
        role:     user.roleName.trim().toLowerCase(),
      },
    };
  })

  // ── PATCH /users/me ────────────────────────────────────────────────────────
  .patch(
    "/me",
    async ({ body, cookie, jwt, set }) => {
      const tokenValue = cookie.token && typeof cookie.token.value === "string" ? cookie.token.value : undefined;
      const auth = await resolveUser({ token: tokenValue }, jwt);

      if (!auth) {
        set.status = 401;
        return { success: false, message: "Unauthorized. Please log in." };
      }

      const { username, email, currentPassword, newPassword } = body;

      // ── Fetch current user record ──────────────────────────────────────────
      const result = await db
        .select({
          id:       users.id,
          username: users.username,
          email:    users.email,
          password: users.password,
        })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1);

      const user = result[0];

      if (!user) {
        set.status = 404;
        return { success: false, message: "User not found." };
      }

      const updates: Partial<{ username: string; email: string; password: string }> = {};

      // ── Username update ────────────────────────────────────────────────────
      if (username !== undefined && username.trim() !== user.username) {
        const taken = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, username.trim()), ne(users.id, auth.userId)))
          .limit(1);

        if (taken[0]) {
          set.status = 409;
          return { success: false, message: "Username is already taken." };
        }

        updates.username = username.trim();
      }

      // ── Email update ───────────────────────────────────────────────────────
      if (email !== undefined && email.trim() !== user.email) {
        const taken = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email.trim()), ne(users.id, auth.userId)))
          .limit(1);

        if (taken[0]) {
          set.status = 409;
          return { success: false, message: "Email is already in use." };
        }

        updates.email = email.trim();
      }

      // ── Password update ────────────────────────────────────────────────────
      if (newPassword !== undefined) {
        if (!currentPassword) {
          set.status = 400;
          return { success: false, message: "Current password is required to set a new password." };
        }

        const isValid = await Bun.password.verify(currentPassword, user.password);
        if (!isValid) {
          set.status = 401;
          return { success: false, message: "Current password is incorrect." };
        }

        updates.password = await Bun.password.hash(newPassword);
      }

      // ── Nothing to update ──────────────────────────────────────────────────
      if (Object.keys(updates).length === 0) {
        return { success: true, message: "No changes were made." };
      }

      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, auth.userId));

      return {
        success: true,
        message: "Profile updated successfully.",
        data: {
          username: updates.username ?? user.username,
          email:    updates.email    ?? user.email,
        },
      };
    },
    {
      body: t.Object({
        username:        t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        email:           t.Optional(t.String({ format: "email" })),
        currentPassword: t.Optional(t.String({ minLength: 1 })),
        newPassword:     t.Optional(t.String({ minLength: 8 })),
      }),
    }
  );
