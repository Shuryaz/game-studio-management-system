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
import { sprints } from "./sprint";
import { users } from "./user";

export const sprintItems = mysqlTable("sprint_items", {
  id: serial("id").primaryKey(),
  externalId: varchar("external_id", { length: 24 }).notNull(),
  sprintId: bigint("sprint_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => sprints.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["High", "Medium", "Lo"]).notNull().default("Medium"),
  status: mysqlEnum("status", ["todo", "in-progress", "testing", "done"]).notNull().default("todo"),
  assignee: varchar("assignee", { length: 200 }),
  assigneeId: bigint("assignee_id", { mode: "number", unsigned: true }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const sprintItemsRelations = relations(sprintItems, ({ one }) => ({
  sprint: one(sprints, { fields: [sprintItems.sprintId], references: [sprints.id] }),
  assigneeUser: one(users, { fields: [sprintItems.assigneeId], references: [users.id] }),
}));
