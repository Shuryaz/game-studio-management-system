-- Migration: create bugs table (with steps, priority, evidence support)

CREATE TABLE IF NOT EXISTS `bugs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `steps` text,
  `severity` enum('Critical','High','Medium','Low') NOT NULL DEFAULT 'Medium',
  `priority` varchar(50) NOT NULL DEFAULT 'P2 - Backlog',
  `status` enum('Open','In Progress','Resolved') NOT NULL DEFAULT 'Open',
  `project` varchar(150),
  `assignee` varchar(200),
  `assignee_id` bigint unsigned,
  `reported_by` varchar(200),
  `evidence_path` varchar(500),
  `evidence_file` varchar(255),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint

ALTER TABLE `bugs`
  ADD CONSTRAINT `bugs_assignee_id_users_id_fk`
  FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;
