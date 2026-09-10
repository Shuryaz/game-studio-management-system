CREATE TABLE `sprints` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`label` varchar(150) NOT NULL,
	`start_date` date,
	`end_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sprints_id` PRIMARY KEY(`id`)
);


CREATE TABLE `tasks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`external_id` varchar(24) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('High','Medium','Low') NOT NULL DEFAULT 'Medium',
	`status` enum('todo','in-progress','testing','done') NOT NULL DEFAULT 'todo',
	`assignee` varchar(200),
	`deadline` date,
	`sprint_id` bigint unsigned,
	`project_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_external_id_unique` UNIQUE(`external_id`)
);


ALTER TABLE `tasks` ADD CONSTRAINT `tasks_sprint_id_sprints_id_fk` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE no action ON UPDATE no action;


ALTER TABLE `tasks` ADD CONSTRAINT `tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;

