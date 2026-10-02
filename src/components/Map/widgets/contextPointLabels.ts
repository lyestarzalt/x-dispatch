import { type Feet, metersToFeet } from '@/lib/utils/geomath';

/** The two `useUnits()` formatters the context menu header needs. */
export interface ContextPointFormatters {
  coordinates: (lat: number, lon: number) => string;
  altitude: (ft: Feet) => string;
}

export interface ContextPointLabels {
  /** Right-clicked point in the user's coordinate format. */
  coordinates: string;
  /** Terrain elevation in the user's altitude unit, or null when terrain is off. */
  elevation: string | null;
}

/**
 * Header text for the map context menu. Terrain elevation arrives in metres
 * from `queryTerrainElevation`, so it goes through canonical feet before the
 * display conversion, same as the compass widget. Pure, so it's unit-tested
 * without a map or a React renderer.
 */
export function buildContextPointLabels(
  lat: number,
  lon: number,
  elevationM: number | null,
  units: ContextPointFormatters
): ContextPointLabels {
  return {
    coordinates: units.coordinates(lat, lon),
    elevation: elevationM == null ? null : units.altitude(metersToFeet(elevationM)),
  };
}
