ALTER TABLE `contact_requests` ADD `analytics_session_id` text;--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `diagnostic_flow_id` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `analytics_session_id` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `diagnostic_flow_id` text;