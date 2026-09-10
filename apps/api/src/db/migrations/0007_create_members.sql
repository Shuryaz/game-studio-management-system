-- Migration: create members table (team directory)

CREATE TABLE IF NOT EXISTS `members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `email` varchar(255) NOT NULL,
  `job_title` varchar(150),
  `department` enum('Engineering','Art & Design','Game Design','Production','QA','Audio') NOT NULL DEFAULT 'Engineering',
  `status` enum('Active','OOO','Inactive') NOT NULL DEFAULT 'Active',
  `status_note` varchar(255),
  `avatar_url` varchar(500),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `members_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
