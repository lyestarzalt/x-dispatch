CREATE TABLE `scenery_index` (
	`full_path` text PRIMARY KEY NOT NULL,
	`scenery_path` text NOT NULL,
	`fingerprint` text NOT NULL,
	`priority` integer NOT NULL,
	`classification` text NOT NULL,
	`scanned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_scenery_index_fingerprint` ON `scenery_index` (`fingerprint`);
