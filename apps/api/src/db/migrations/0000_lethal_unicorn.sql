CREATE TABLE `roles` (
	`role_id` serial AUTO_INCREMENT NOT NULL,
	`role_name` varchar(50) NOT NULL,
	CONSTRAINT `roles_role_id` PRIMARY KEY(`role_id`),
	CONSTRAINT `roles_role_name_unique` UNIQUE(`role_name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`role_id` bigint unsigned NOT NULL,
	`username` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE no action ON UPDATE no action;