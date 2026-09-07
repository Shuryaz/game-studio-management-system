import { mysqlTable, serial, varchar } from "drizzle-orm/mysql-core";

export const roles = mysqlTable("roles", {
  roleId: serial("role_id").primaryKey(),
  roleName: varchar("role_name", { length: 50 }).notNull().unique(),
});
