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
    elevation: real('elevation'),
    data: text('data'), // Raw apt.dat data for this airport
  },
  (table) => ({
    coordsIdx: index('idx_airports_coords').on(table.lat, table.lon),
  })
);

/**
 * Metadata table - stores app configuration and state
 */
export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// Type exports for use in application code
export type Airport = typeof airports.$inferSelect;
export type NewAirport = typeof airports.$inferInsert;
export type Metadata = typeof metadata.$inferSelect;
