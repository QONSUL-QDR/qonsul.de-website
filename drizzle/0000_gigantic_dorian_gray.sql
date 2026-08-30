CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires_at` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`analysis` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text NOT NULL,
	`consent_version` text NOT NULL,
	`consent_at` integer NOT NULL,
	`crm_consent` integer DEFAULT 0 NOT NULL,
	`crm_status` text DEFAULT 'not_requested' NOT NULL,
	`crm_contact_id` text,
	`crm_note_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_token_hash_unique` ON `reports` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_reports_expires_at` ON `reports` (`expires_at`);--> statement-breakpoint
CREATE TABLE `trends` (
	`key` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`quarter` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
