CREATE TABLE `contact_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_token_hash` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`company` text,
	`message` text NOT NULL,
	`privacy_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`crm_status` text DEFAULT 'pending' NOT NULL,
	`crm_contact_id` text,
	`crm_note_id` text,
	`email_status` text DEFAULT 'pending' NOT NULL,
	`email_provider_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_requests_client_token_hash_unique` ON `contact_requests` (`client_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_contact_requests_expires_at` ON `contact_requests` (`expires_at`);
