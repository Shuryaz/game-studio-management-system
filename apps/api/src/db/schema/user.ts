import { mysqlTable, serial, varchar, bigint } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { roles } from "./role";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  roleId: bigint("role_id", { mode: "number", unsigned: true }).notNull().references(() => roles.roleId),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.roleId],
  }),
}));
