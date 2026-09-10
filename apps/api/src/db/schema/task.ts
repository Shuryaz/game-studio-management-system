import {
  mysqlTable,
  serial,
  varchar,
  text,
  bigint,
  date,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { sprints } from "./sprint";
import { projects } from "./project";
import { users } from "./user";
import { decimal } from "drizzle-orm/mysql-core";

export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  externalId: varchar("external_id", { length: 24 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["High", "Medium", "Low"]).notNull().default("Medium"),
  status: mysqlEnum("status", ["todo", "in-progress", "testing", "done"]).notNull().default("todo"),
  assignee: varchar("assignee", { length: 200 }),
  deadline: date("deadline", { mode: "string" }),
  sprintId: bigint("sprint_id", { mode: "number", unsigned: true }).references(() => sprints.id),
  projectId: bigint("project_id", { mode: "number", unsigned: true }).references(() => projects.id),
  assigneeId: bigint("assignee_id", { mode: "number", unsigned: true }).references(() => users.id),
  estimateHours: decimal("estimate_hours", { precision: 6, scale: 2 }),
  timeSpentHours: decimal("time_spent_hours", { precision: 6, scale: 2 }).default("0.00"),
  tags: varchar("tags", { length: 255 }),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  sprint: one(sprints, { fields: [tasks.sprintId], references: [sprints.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
}));
