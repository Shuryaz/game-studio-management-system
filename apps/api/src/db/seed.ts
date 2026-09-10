import { db } from "./index";
import { roles } from "./schema/role";
import { users } from "./schema/user";
import { eq } from "drizzle-orm";

console.log("Seeding database...");

// ── 1. Ensure all roles exist ────────────────────────────────────────────────
const requiredRoles = ["admin", "producer", "developer", "designer", "qa"];

for (const roleName of requiredRoles) {
  const existing = await db
    .select()
    .from(roles)
    .where(eq(roles.roleName, roleName))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    await db.insert(roles).values({ roleName });
    console.log(`Role '${roleName}' created.`);
  } else {
    console.log(`Role '${roleName}' already exists.`);
  }
}

// ── 2. Ensure mikka user exists with admin role ──────────────────────────────
const adminRole = await db
  .select()
  .from(roles)
  .where(eq(roles.roleName, "admin"))
  .limit(1)
  .then((r) => r[0]);

if (!adminRole) throw new Error("Failed to resolve 'admin' role.");

const existingUser = await db
  .select()
  .from(users)
  .where(eq(users.username, "mikka"))
  .limit(1)
  .then((r) => r[0]);

if (!existingUser) {
  const hashedPassword = await Bun.password.hash("thefool");
  await db.insert(users).values({
    roleId: adminRole.roleId,
    username: "mikka",
    email: "mika@testmail.com",
    password: hashedPassword,
  });
  console.log("User 'mikka' created with role 'admin'.");
} else {
  await db
    .update(users)
    .set({ roleId: adminRole.roleId })
    .where(eq(users.username, "mikka"));
  console.log("User 'mikka' role updated to 'admin'.");
}

// ── 3. Sync all users to members directory table ─────────────────────────────
const allUsers = await db
  .select({
    id: users.id,
    username: users.username,
    email: users.email,
    roleName: roles.roleName,
  })
  .from(users)
  .leftJoin(roles, eq(users.roleId, roles.roleId));

const { members } = await import("./schema/member");

for (const u of allUsers) {
  const existingMember = await db
    .select()
    .from(members)
    .where(eq(members.email, u.email))
    .limit(1)
    .then((m) => m[0]);

  const displayJobTitle = u.roleName
    ? u.roleName.charAt(0).toUpperCase() + u.roleName.slice(1)
    : "Developer";

  if (!existingMember) {
    await db.insert(members).values({
      userId: u.id,
      name: u.username,
      email: u.email,
      jobTitle: displayJobTitle,
      department: u.roleName === "admin" || u.roleName === "producer" ? "Production" : "Engineering",
      status: "Active",
    });
    console.log(`Synced user '${u.username}' to members directory.`);
  } else if (!existingMember.userId) {
    await db
      .update(members)
      .set({ userId: u.id, jobTitle: displayJobTitle })
      .where(eq(members.id, existingMember.id));
    console.log(`Updated user_id for member '${existingMember.name}'.`);
  }
}

console.log("Seeding complete.");
process.exit(0);

