import {
  mysqlTable,
  serial,
  varchar,
  text,
  bigint,
  timestamp,
  mysqlEnum,
  int,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./user";

export const assets = mysqlTable("assets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  assetType: mysqlEnum("asset_type", ["3D Model", "Texture", "Audio", "VFX", "UI"]).notNull(),
  category: mysqlEnum("category", ["Characters", "Environment", "Audio", "VFX", "UI"]).notNull(),
  status: mysqlEnum("status", ["Approved", "In Review", "Draft"]).notNull().default("Draft"),
  format: varchar("format", { length: 50 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: bigint("file_size", { mode: "number", unsigned: true }).notNull(),
  version: varchar("version", { length: 20 }),
  description: text("description"),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const assetsRelations = relations(assets, ({ one }) => ({
  uploader: one(users, { fields: [assets.uploadedBy], references: [users.id] }),
}));
