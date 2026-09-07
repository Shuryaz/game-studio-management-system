import { db } from "./index";
import { roles } from "./schema/role";
import { users } from "./schema/user";
import { eq } from "drizzle-orm";

console.log("Seeding database...");

// 1. Insert programmer role if not exists
let role = await db
  .select()
  .from(roles)
  .where(eq(roles.roleName, "programmer"))
  .limit(1)
  .then((r) => r[0]);

if (!role) {
  await db.insert(roles).values({ roleName: "programmer" });
  role = await db
    .select()
    .from(roles)
    .where(eq(roles.roleName, "programmer"))
    .limit(1)
    .then((r) => r[0]);
  if (!role) throw new Error("Failed to create role 'programmer'.");
  console.log("Role 'programmer' created.");
} else {
  console.log("Role 'programmer' already exists.");
}

// 2. Insert mikka user if not exists
const existingUser = await db
  .select()
  .from(users)
  .where(eq(users.username, "mikka"))
  .limit(1)
  .then((r) => r[0]);

if (!existingUser) {
  const hashedPassword = await Bun.password.hash("thefool");
  await db.insert(users).values({
    roleId: role.roleId,
    username: "mikka",
    email: "mika@testmail.com",
    password: hashedPassword,
  });
  console.log("User 'mikka' created.");
} else {
  console.log("User 'mikka' already exists.");
}

console.log("Seeding complete.");
process.exit(0);
