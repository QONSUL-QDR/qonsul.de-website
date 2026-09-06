CREATE INDEX `idx_contact_requests_analytics_session_id` ON `contact_requests` (`analytics_session_id`);--> statement-breakpoint
CREATE INDEX `idx_contact_requests_diagnostic_flow_id` ON `contact_requests` (`diagnostic_flow_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_analytics_session_id` ON `reports` (`analytics_session_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_diagnostic_flow_id` ON `reports` (`diagnostic_flow_id`);