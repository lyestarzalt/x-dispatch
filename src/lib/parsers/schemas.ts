/**
 * Reusable Zod schemas for X-Plane data parsing
 * These correspond to TypeScript types in src/types/
 */
import { z } from 'zod';

// Primitives
export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);
export const bearing = z.number().min(0).max(360);
export const vhfFrequency = z.number().min(108).max(137);
// Upper airways and holds reach FL660 in Europe; a top of 0 means open.
export const flightLevel = z.number().min(0).max(999);
export const altitude = z.number().min(-2000).max(99999);
export const positiveNumber = z.number().positive();
export const nonNegative = z.number().nonnegative();

// Geo types (matches src/types/geo.ts)
export const coordinate = z.object({
  latitude,
  longitude,
});

export const lonLat = z.tuple([longitude, latitude]);

export const position = coordinate.extend({
  heading: bearing.optional(),
});
