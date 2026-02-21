/**
 * Database Schema - Drizzle ORM
 * Defines all tables for X-Plane data storage
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Airports table - stores airport data from apt.dat
 */
export const airports = sqliteTable(
  'airports',
  {
    icao: text('icao').primaryKey(),
    name: text('name').notNull(),
    lat: real('lat').notNull(),
    lon: real('lon').notNull(),
    type: text('type', { enum: ['land', 'seaplane', 'heliport'] }).notNull(),
    elevation: integer('elevation'),
    data: text('data'),
    sourceFile: text('source_file'),
    // Metadata from 1302 rows
    city: text('city'),
    country: text('country'),
    iataCode: text('iata_code'),
    faaCode: text('faa_code'),
    regionCode: text('region_code'),
    state: text('state'),
    transitionAlt: integer('transition_alt'),
    transitionLevel: text('transition_level'),
    towerServiceType: text('tower_service_type'),
    driveOnLeft: integer('drive_on_left', { mode: 'boolean' }),
    guiLabel: text('gui_label'),
  },
  (table) => [
    index('idx_airports_coords').on(table.lat, table.lon),
    index('idx_airports_iata').on(table.iataCode),
    index('idx_airports_country').on(table.country),
    index('idx_airports_region').on(table.regionCode),
  ]
);

/**
 * Track apt.dat file metadata for cache invalidation
 */
export const aptFileMeta = sqliteTable('apt_file_meta', {
  path: text('path').primaryKey(),
  mtime: integer('mtime').notNull(),
  airportCount: integer('airport_count'),
});

/**
 * Metadata table - stores app configuration and state
 */
export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// ============================================================================
// Navigation Data Tables
// ============================================================================

/**
 * Track nav data file metadata for cache invalidation
 */
export const navFileMeta = sqliteTable('nav_file_meta', {
  path: text('path').primaryKey(),
  mtime: integer('mtime').notNull(),
  recordCount: integer('record_count'),
  dataType: text('data_type').notNull(), // 'navaids', 'waypoints', 'airways', 'airspaces'
  sourceType: text('source_type').notNull().default('unknown'), // 'navigraph', 'xplane-default', 'unknown'
});

/**
 * Navaids table - stores VOR, NDB, DME, ILS, etc. from earth_nav.dat
 */
export const navaids = sqliteTable(
  'navaids',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    navaidId: text('navaid_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    lat: real('lat').notNull(),
    lon: real('lon').notNull(),
    elevation: integer('elevation'),
    frequency: integer('frequency'),
    range: integer('range'),
    magneticVariation: real('magnetic_variation'),
    region: text('region'),
    country: text('country'),
    bearing: real('bearing'),
    associatedAirport: text('associated_airport'),
    associatedRunway: text('associated_runway'),
    glidepathAngle: real('glidepath_angle'),
    course: real('course'),
    lengthOffset: real('length_offset'),
    thresholdCrossingHeight: real('threshold_crossing_height'),
    refPathIdentifier: text('ref_path_identifier'),
    approachPerformance: text('approach_performance'),
  },
  (table) => [
    index('idx_navaids_coords').on(table.lat, table.lon),
    index('idx_navaids_type').on(table.type),
    index('idx_navaids_navaid_id').on(table.navaidId),
    index('idx_navaids_airport').on(table.associatedAirport),
  ]
);

/**
 * Waypoints table - stores fixes from earth_fix.dat
 */
export const waypoints = sqliteTable(
  'waypoints',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    waypointId: text('waypoint_id').notNull(),
    lat: real('lat').notNull(),
    lon: real('lon').notNull(),
    region: text('region').notNull(),
    areaCode: text('area_code').notNull(),
    description: text('description'),
  },
  (table) => [
    index('idx_waypoints_coords').on(table.lat, table.lon),
    index('idx_waypoints_waypoint_id').on(table.waypointId),
    index('idx_waypoints_region').on(table.region),
  ]
);

/**
 * Airways table - stores airway segments from earth_awy.dat
 */
export const airways = sqliteTable(
  'airways',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    fromFix: text('from_fix').notNull(),
    fromRegion: text('from_region').notNull(),
    fromNavaidType: integer('from_navaid_type').notNull(),
    toFix: text('to_fix').notNull(),
    toRegion: text('to_region').notNull(),
    toNavaidType: integer('to_navaid_type').notNull(),
    isHigh: integer('is_high', { mode: 'boolean' }).notNull(),
    baseFl: integer('base_fl').notNull(),
    topFl: integer('top_fl').notNull(),
    direction: integer('direction').notNull(),
  },
  (table) => [
    index('idx_airways_name').on(table.name),
    index('idx_airways_from_fix').on(table.fromFix),
    index('idx_airways_to_fix').on(table.toFix),
  ]
);

/**
 * Airspaces table - stores airspace boundaries from airspace.txt
 */
export const airspaces = sqliteTable(
  'airspaces',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    airspaceClass: text('airspace_class').notNull(),
    upperLimit: text('upper_limit'),
    lowerLimit: text('lower_limit'),
    coordinates: text('coordinates').notNull(), // JSON array of [lon, lat] pairs
  },
  (table) => [index('idx_airspaces_class').on(table.airspaceClass)]
);

// Type exports
export type Airport = typeof airports.$inferSelect;
export type NewAirport = typeof airports.$inferInsert;
export type AptFileMeta = typeof aptFileMeta.$inferSelect;
export type NewAptFileMeta = typeof aptFileMeta.$inferInsert;
export type Metadata = typeof metadata.$inferSelect;
export type NavFileMeta = typeof navFileMeta.$inferSelect;
export type NewNavFileMeta = typeof navFileMeta.$inferInsert;
export type DbNavaid = typeof navaids.$inferSelect;
export type NewDbNavaid = typeof navaids.$inferInsert;
export type DbWaypoint = typeof waypoints.$inferSelect;
export type NewDbWaypoint = typeof waypoints.$inferInsert;
export type DbAirway = typeof airways.$inferSelect;
export type NewDbAirway = typeof airways.$inferInsert;
export type DbAirspace = typeof airspaces.$inferSelect;
export type NewDbAirspace = typeof airspaces.$inferInsert;
