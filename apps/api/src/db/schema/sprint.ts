import { mysqlTable, serial, varchar, date, timestamp, bigint, mysqlEnum, text } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { projects } from "./project";
import { users } from "./user";

export const sprints = mysqlTable("sprints", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 150 }).notNull(),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  projectId: bigint("project_id", { mode: "number", unsigned: true }).references(() => projects.id),
  ownerId: bigint("owner_id", { mode: "number", unsigned: true }).references(() => users.id),
  status: mysqlEnum("status", ["planned", "active", "completed", "archived"]).notNull().default("planned"),
  goal: text("goal"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project: one(projects, { fields: [sprints.projectId], references: [projects.id] }),
  owner: one(users, { fields: [sprints.ownerId], references: [users.id] }),
  // tasks relation declared in tasks schema
}));
