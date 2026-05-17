CREATE TABLE `sia_charts` (
	`icao` text PRIMARY KEY NOT NULL,
	`chart_type` text NOT NULL,
	`pdf_path` text NOT NULL,
	`chart_id` text,
	`cycle` text,
	`valid_from` text,
	`valid_to` text,
	`installed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sia_charts_cycle` ON `sia_charts` (`cycle`);
