-- Migration: create assets table

CREATE TABLE IF NOT EXISTS `assets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `asset_type` enum('3D Model','Texture','Audio','VFX','UI') NOT NULL,
  `category` enum('Characters','Environment','Audio','VFX','UI') NOT NULL,
  `status` enum('Approved','In Review','Draft') NOT NULL DEFAULT 'Draft',
  `format` varchar(50) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_size` bigint unsigned NOT NULL,
  `version` varchar(20),
  `description` text,
  `uploaded_by` bigint unsigned,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint

ALTER TABLE `assets`
  ADD CONSTRAINT `assets_uploaded_by_users_id_fk`
  FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;
