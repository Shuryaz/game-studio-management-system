-- Migration: connect members to users table
ALTER TABLE `members` ADD COLUMN `user_id` bigint unsigned NULL REFERENCES `users`(`id`) ON DELETE CASCADE;
