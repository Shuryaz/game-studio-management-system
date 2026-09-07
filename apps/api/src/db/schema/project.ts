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
import { users } from "./user";
import { projectMembers } from "./project-member";

export const projects = mysqlTable("projects", {
  id:             serial("id").primaryKey(),

  name:           varchar("name", { length: 150 }).notNull(),
  description:    text("description"),

  genre:          varchar("genre", { length: 100 }),
  platform:       varchar("platform", { length: 255 }), // comma-separated or JSON string for multiple platforms

  status:         mysqlEnum("status", [
                    "Pre-production",
                    "Alpha",
                    "Beta",
                    "Live",
                    "Cancelled",
                  ]).notNull().default("Pre-production"),

  leadProducerId: bigint("lead_producer_id", { mode: "number", unsigned: true })
                    .references(() => users.id),

  startDate:      date("start_date"),
  targetDate:     date("target_date"),

  createdBy:      bigint("created_by", { mode: "number", unsigned: true })
                    .notNull()
                    .references(() => users.id),

  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  leadProducer: one(users, {
    fields: [projects.leadProducerId],
    references: [users.id],
    relationName: "project_lead",
  }),
  createdByUser: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
    relationName: "project_creator",
  }),
  members: many(projectMembers),
}));
