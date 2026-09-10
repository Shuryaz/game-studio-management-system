import {
  mysqlTable,
  serial,
  varchar,
  text,
  bigint,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./user";

export const bugs = mysqlTable("bugs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  steps: text("steps"),
  severity: mysqlEnum("severity", ["Critical", "High", "Medium", "Low"]).notNull().default("Medium"),
  priority: varchar("priority", { length: 50 }).notNull().default("P2 - Backlog"),
  status: mysqlEnum("status", ["Open", "In Progress", "Resolved"]).notNull().default("Open"),
  project: varchar("project", { length: 150 }),
  assignee: varchar("assignee", { length: 200 }),
  assigneeId: bigint("assignee_id", { mode: "number", unsigned: true }).references(() => users.id),
  reportedBy: varchar("reported_by", { length: 200 }),
  evidencePath: varchar("evidence_path", { length: 500 }),
  evidenceFile: varchar("evidence_file", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const bugsRelations = relations(bugs, ({ one }) => ({
  assigneeUser: one(users, { fields: [bugs.assigneeId], references: [users.id] }),
}));
