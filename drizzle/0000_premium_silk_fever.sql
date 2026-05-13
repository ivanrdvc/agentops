CREATE TABLE `alert_rule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discovery_cursor` (
	`kind` text PRIMARY KEY NOT NULL,
	`last_scanned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbox_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer,
	`kind` text NOT NULL,
	`fired_at` integer NOT NULL,
	`summary` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`trace_id` text,
	`session_id` text,
	`dedupe_key` text NOT NULL,
	`dismissed_at` integer,
	`snooze_until` integer,
	FOREIGN KEY (`rule_id`) REFERENCES `alert_rule`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbox_item_dedupe_key_idx` ON `inbox_item` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `inbox_item_open_idx` ON `inbox_item` (`dismissed_at`,`snooze_until`,`fired_at`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`namespace` text DEFAULT '' NOT NULL,
	`first_seen_at` integer NOT NULL,
	`first_seen_trace_id` text,
	`last_seen_at` integer NOT NULL,
	`owner` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_kind_name_namespace_idx` ON `inventory` (`kind`,`name`,`namespace`);