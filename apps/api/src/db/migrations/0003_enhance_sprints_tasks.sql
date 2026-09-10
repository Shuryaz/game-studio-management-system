ALTER TABLE `sprints`
  ADD COLUMN `project_id` bigint unsigned,
  ADD COLUMN `owner_id` bigint unsigned,
  ADD COLUMN `status` enum('planned','active','completed','archived') NOT NULL DEFAULT 'planned',
  ADD COLUMN `goal` text,
  ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint

ALTER TABLE `sprints` ADD CONSTRAINT `sprints_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE no action;
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `tasks`
  ADD COLUMN `assignee_id` bigint unsigned,
  ADD COLUMN `estimate_hours` decimal(6,2) DEFAULT NULL,
  ADD COLUMN `time_spent_hours` decimal(6,2) DEFAULT 0,
  ADD COLUMN `tags` varchar(255) DEFAULT NULL,
  ADD COLUMN `created_by` bigint unsigned;
--> statement-breakpoint

ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assignee_id_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE no action;
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE no action;
