import {
  mysqlTable,
  serial,
  varchar,
  timestamp,
  mysqlEnum,
  bigint,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./user";

export const members = mysqlTable("members", {
  id:         serial("id").primaryKey(),
  userId:     bigint("user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "cascade" }),
  name:       varchar("name",       { length: 150 }).notNull(),
  email:      varchar("email",      { length: 255 }).notNull().unique(),
  jobTitle:   varchar("job_title",  { length: 150 }),
  department: mysqlEnum("department", ["Engineering", "Art & Design", "Game Design", "Production", "QA", "Audio"]).notNull().default("Engineering"),
  status:     mysqlEnum("status",     ["Active", "OOO", "Inactive"]).notNull().default("Active"),
  statusNote: varchar("status_note", { length: 255 }),
  avatarUrl:  varchar("avatar_url",  { length: 500 }),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const membersRelations = relations(members, ({ one }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
}));

