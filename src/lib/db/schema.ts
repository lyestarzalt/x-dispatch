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

// Type exports
export type Airport = typeof airports.$inferSelect;
export type NewAirport = typeof airports.$inferInsert;
export type AptFileMeta = typeof aptFileMeta.$inferSelect;
export type NewAptFileMeta = typeof aptFileMeta.$inferInsert;
export type Metadata = typeof metadata.$inferSelect;
