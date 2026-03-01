CREATE TABLE `airports` (
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
CREATE INDEX `idx_airports_coords` ON `airports` (`lat`,`lon`);--> statement-breakpoint
CREATE INDEX `idx_airports_iata` ON `airports` (`iata_code`);--> statement-breakpoint
CREATE INDEX `idx_airports_country` ON `airports` (`country`);--> statement-breakpoint
CREATE INDEX `idx_airports_region` ON `airports` (`region_code`);--> statement-breakpoint
CREATE TABLE `airspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`airspace_class` text NOT NULL,
	`upper_limit` text,
	`lower_limit` text,
	`coordinates` text NOT NULL,
	`min_lat` real,
	`max_lat` real,
	`min_lon` real,
	`max_lon` real
);
--> statement-breakpoint
CREATE INDEX `idx_airspaces_class` ON `airspaces` (`airspace_class`);--> statement-breakpoint
CREATE INDEX `idx_airspaces_bounds` ON `airspaces` (`min_lat`,`max_lat`,`min_lon`,`max_lon`);--> statement-breakpoint
CREATE TABLE `airways` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`from_fix` text NOT NULL,
	`from_region` text NOT NULL,
	`from_navaid_type` integer NOT NULL,
	`to_fix` text NOT NULL,
	`to_region` text NOT NULL,
	`to_navaid_type` integer NOT NULL,
	`is_high` integer NOT NULL,
	`base_fl` integer NOT NULL,
	`top_fl` integer NOT NULL,
	`direction` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_airways_name` ON `airways` (`name`);--> statement-breakpoint
CREATE INDEX `idx_airways_from_fix` ON `airways` (`from_fix`);--> statement-breakpoint
CREATE INDEX `idx_airways_to_fix` ON `airways` (`to_fix`);--> statement-breakpoint
CREATE TABLE `apt_file_meta` (
	`path` text PRIMARY KEY NOT NULL,
	`mtime` integer NOT NULL,
	`airport_count` integer
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `nav_file_meta` (
	`path` text PRIMARY KEY NOT NULL,
	`mtime` integer NOT NULL,
	`record_count` integer,
	`data_type` text NOT NULL,
	`source_type` text DEFAULT 'unknown' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `navaids` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`navaid_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`elevation` integer,
	`frequency` integer,
	`range` integer,
	`magnetic_variation` real,
	`region` text,
	`country` text,
	`bearing` real,
	`associated_airport` text,
	`associated_runway` text,
	`glidepath_angle` real,
	`course` real,
	`length_offset` real,
	`threshold_crossing_height` real,
	`ref_path_identifier` text,
	`approach_performance` text
);
--> statement-breakpoint
CREATE INDEX `idx_navaids_coords` ON `navaids` (`lat`,`lon`);--> statement-breakpoint
CREATE INDEX `idx_navaids_type` ON `navaids` (`type`);--> statement-breakpoint
CREATE INDEX `idx_navaids_navaid_id` ON `navaids` (`navaid_id`);--> statement-breakpoint
CREATE INDEX `idx_navaids_airport` ON `navaids` (`associated_airport`);--> statement-breakpoint
CREATE INDEX `idx_navaids_id_region` ON `navaids` (`navaid_id`,`region`);--> statement-breakpoint
CREATE TABLE `waypoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`waypoint_id` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`region` text NOT NULL,
	`area_code` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE INDEX `idx_waypoints_coords` ON `waypoints` (`lat`,`lon`);--> statement-breakpoint
CREATE INDEX `idx_waypoints_waypoint_id` ON `waypoints` (`waypoint_id`);--> statement-breakpoint
CREATE INDEX `idx_waypoints_region` ON `waypoints` (`region`);--> statement-breakpoint
CREATE INDEX `idx_waypoints_id_region` ON `waypoints` (`waypoint_id`,`region`);