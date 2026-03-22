CREATE TABLE `airports_custom` (
	`icao` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`type` text NOT NULL,
	`elevation` integer,
	`data` text,
	`source_file` text,
	`city` text,
	`country` text,
	`iata_code` text,
	`faa_code` text,
	`region_code` text,
	`state` text,
	`transition_alt` integer,
	`transition_level` text,
	`tower_service_type` text,
	`drive_on_left` integer,
	`gui_label` text,
	`runway_count` integer,
	`primary_surface_type` integer
);
--> statement-breakpoint
CREATE INDEX `idx_airports_custom_coords` ON `airports_custom` (`lat`,`lon`);--> statement-breakpoint
CREATE INDEX `idx_airports_custom_country` ON `airports_custom` (`country`);