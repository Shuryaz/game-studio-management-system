-- Migration: create sprint_items table
-- Sprint items are kanban cards that belong to a sprint (separate from general tasks)

CREATE TABLE IF NOT EXISTS `sprint_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `external_id` varchar(24) NOT NULL,
  `sprint_id` bigint unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `priority` enum('High','Medium','Lo') NOT NULL DEFAULT 'Medium',
  `status` enum('todo','in-progress','testing','done') NOT NULL DEFAULT 'todo',
  `assignee` varchar(200),
  `assignee_id` bigint unsigned,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint

ALTER TABLE `sprint_items`
  ADD CONSTRAINT `sprint_items_sprint_id_sprints_id_fk`
    FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE `sprint_items`
  ADD CONSTRAINT `sprint_items_assignee_id_users_id_fk`
    FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- Drop sprint_id from tasks (tasks are now standalone)
-- The IF clause protects against re-running on a DB that already dropped it
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND CONSTRAINT_NAME = 'tasks_sprint_id_sprints_id_fk'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @drop_fk = IF(@fk_exists > 0,
  'ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_sprint_id_sprints_id_fk`',
  'SELECT 1'
);
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'sprint_id'
);

SET @drop_col = IF(@col_exists > 0,
  'ALTER TABLE `tasks` DROP COLUMN `sprint_id`',
  'SELECT 1'
);
PREPARE stmt FROM @drop_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
