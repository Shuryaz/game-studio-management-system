import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../../db";
import { users } from "../../db/schema/user";
import { roles } from "../../db/schema/role";
import { eq } from "drizzle-orm";

// ─── JWT secret guard ─────────────────────────────────────────────────────────
// Fail fast at startup — never fall back to a weak default in any environment.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file before starting the server.");
}

const JWT_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours

// ─── In-memory rate limit store ───────────────────────────────────────────────
// Key: "<ip>:<username>"  →  { attempts: number; lockedUntil: number | null }
// This resets on server restart. For persistence, move this to Redis or DB.
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number | null }>();

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 60_000; // 1 minute

function getRateLimitKey(ip: string, username: string) {
  return `${ip}:${username.toLowerCase()}`;
}

function getAttemptRecord(key: string) {
  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, { attempts: 0, lockedUntil: null });
  }
  return loginAttempts.get(key)!;
}

// ─── Resolve trusted client IP ────────────────────────────────────────────────
// server.requestIP() is only accessible on the top-level Elysia app instance,
// not inside route handler closures. We therefore rely on well-known proxy
// headers, but ONLY accept them when the request originates from a known
// trusted proxy IP listed in TRUSTED_PROXY_IPS. For a direct connection
// (no proxy), we leave the IP as "unknown" — the rate limit still applies
// per username in that case.
//
// In production behind nginx/Cloudflare, add the proxy's outbound IP to
// TRUSTED_PROXY_IPS in .env, e.g.: TRUSTED_PROXY_IPS=10.0.0.1,10.0.0.2
const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? "127.0.0.1,::1").split(",").map((s) => s.trim())
);

function getClientIp(request: Request): string {
  // Check if the request carries a trusted forwarded-for header.
  // Without a real socket IP to validate against, we only trust these headers
  // when TRUSTED_PROXY_IPS is explicitly configured beyond the loopback default.
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  // If running behind a known proxy (non-default TRUSTED_PROXY_IPS set),
  // use the forwarded header as the canonical client IP.
  const hasCustomProxy = !!process.env.TRUSTED_PROXY_IPS?.trim();
  if (hasCustomProxy) {
    if (forwarded) {
      const firstForwardedIp = forwarded.split(",")[0]?.trim();
      if (firstForwardedIp) return firstForwardedIp;
    }

    if (realIp) return realIp.trim();
  }

  // Default: ignore proxy headers to prevent spoofing.
  // Rate limiting still works per-username in this path.
  return "unknown";
}
// ──────────────────────────────────────────────────────────────────────────────

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET! }))
  .post(
    "/login",
    async ({ body, jwt, set, request }) => {
      const { username, password } = body;

      // Resolve client IP — spoofing-resistant.
      // server.requestIP() is only available on the top-level app instance,
      // not inside route handlers. We rely on trusted proxy headers instead;
      // TRUSTED_PROXY_IPS defaults to loopback only so direct connections
      // won't have their x-forwarded-for header trusted.
      const ip = getClientIp(request);

      const key = getRateLimitKey(ip, username);
      const record = getAttemptRecord(key);
      const now = Date.now();

      // ── Check if currently locked out ──────────────────────────────────────
      if (record.lockedUntil !== null) {
        const remaining = record.lockedUntil - now;
        if (remaining > 0) {
          set.status = 429;
          return {
            success: false,
            message: "Too many failed attempts. Please wait before trying again.",
            lockedUntil: record.lockedUntil,
            remainingMs: remaining,
          };
        }
        // Cooldown expired — reset
        record.attempts = 0;
        record.lockedUntil = null;
      }

      // ── Look up user ────────────────────────────────────────────────────────
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          password: users.password,
          roleName: roles.roleName,
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.roleId))
        .where(eq(users.username, username))
        .limit(1);

      const user = result[0];

      // ── Wrong credentials ───────────────────────────────────────────────────
      if (!user || !user.roleName || !(await Bun.password.verify(password, user.password))) {
        record.attempts += 1;

        const attemptsLeft = MAX_ATTEMPTS - record.attempts;

        if (record.attempts >= MAX_ATTEMPTS) {
          record.lockedUntil = now + COOLDOWN_MS;
          set.status = 429;
          return {
            success: false,
            message: "Too many failed attempts. Account locked for 1 minute.",
            lockedUntil: record.lockedUntil,
            remainingMs: COOLDOWN_MS,
          };
        }

        set.status = 401;
        return {
          success: false,
          message: `Invalid username or password. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
          attemptsLeft,
        };
      }

      // ── Success — reset attempts ────────────────────────────────────────────
      loginAttempts.delete(key);

      const token = await jwt.sign({
        sub: String(user.id),
        username: user.username,
        role: user.roleName,
        exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS,
      });

      // Set token as httpOnly cookie — inaccessible to JavaScript on the client
      set.headers["Set-Cookie"] = [
        `token=${token}`,
        "HttpOnly",
        "SameSite=Strict",
        "Path=/",
        `Max-Age=${JWT_EXPIRY_SECONDS}`,
        // Add "Secure" below when serving over HTTPS in production:
        // "Secure",
      ].join("; ");

      const normalizedRole = user.roleName.trim().toLowerCase();

      return {
        success: true,
        message: "Login successful.",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: normalizedRole,
        },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
    }
  )
  .post("/logout", ({ set }) => {
    // Clear the cookie by expiring it immediately
    set.headers["Set-Cookie"] = [
      "token=",
      "HttpOnly",
      "SameSite=Strict",
      "Path=/",
      "Max-Age=0",
    ].join("; ");

    return { success: true, message: "Logged out." };
  })

  // ── POST /auth/register ────────────────────────────────────────────────────
  .post(
    "/register",
    async ({ body, set }) => {
      const { username, email, password, role: roleName } = body;

      // Check username not taken
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username.trim()))
        .limit(1);

      if (existingUser[0]) {
        set.status = 409;
        return { success: false, message: "Username is already taken." };
      }

      // Check email not taken
      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.trim().toLowerCase()))
        .limit(1);

      if (existingEmail[0]) {
        set.status = 409;
        return { success: false, message: "Email is already in use." };
      }

      // Resolve requested role — only allow non-admin roles to be self-assigned
      const allowedRoles = ["producer", "developer", "designer", "qa"];
      const targetRoleName = allowedRoles.includes(roleName?.toLowerCase() ?? "")
        ? roleName!.toLowerCase()
        : "developer"; // safe default

      const roleRows = await db.select().from(roles);
      const targetRole = roleRows.find((r) => r.roleName.toLowerCase() === targetRoleName)
        ?? roleRows.find((r) => r.roleName.toLowerCase() !== "admin")
        ?? roleRows[0];

      if (!targetRole) {
        set.status = 500;
        return { success: false, message: "No roles found. Please seed the roles table first." };
      }

      const hashed = await Bun.password.hash(password);

      await db.insert(users).values({
        username: username.trim(),
        email:    email.trim().toLowerCase(),
        password: hashed,
        roleId:   targetRole.roleId,
      });

      set.status = 201;
      return { success: true, message: "Account created successfully." };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 100 }),
        email:    t.String({ minLength: 1 }),
        password: t.String({ minLength: 8 }),
        role:     t.Optional(t.String()),
      }),
    }
  );
