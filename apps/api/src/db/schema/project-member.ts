import {
  mysqlTable,
  serial,
  bigint,
  varchar,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { projects } from "./project";
import { users } from "./user";

export const projectMembers = mysqlTable("project_members", {
  id:          serial("id").primaryKey(),

  projectId:   bigint("project_id", { mode: "number", unsigned: true })
                 .notNull()
                 .references(() => projects.id),

  userId:      bigint("user_id", { mode: "number", unsigned: true })
                 .notNull()
                 .references(() => users.id),

  projectRole: varchar("project_role", { length: 100 }).notNull(), // e.g. "Producer", "Developer", "Artist"

  joinedAt:    timestamp("joined_at").notNull().defaultNow(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("uq_project_member").on(t.projectId, t.userId),
]);

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));
