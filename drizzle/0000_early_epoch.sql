CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`color` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_owner_name` ON `companies` (`owner`,`name`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`place` text NOT NULL,
	`note` text NOT NULL,
	`image_key` text NOT NULL,
	`mime` text NOT NULL,
	`hash` text NOT NULL,
	`sync` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_owner_hash` ON `receipts` (`owner`,`hash`);--> statement-breakpoint
CREATE INDEX `receipts_owner_date` ON `receipts` (`owner`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`recipient` text NOT NULL
);
