CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`collection` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`collection`, `id`)
);
--> statement-breakpoint
CREATE INDEX `records_collection_created` ON `records` (`collection`,`created_at`);