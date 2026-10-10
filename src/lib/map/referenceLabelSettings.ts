/**
 * What the user can change about the labels laid over an image basemap: which
 * kinds show, how white the text is and how large. Kept apart from the overlay
 * builder so the settings store can import it without pulling in MapLibre.
 */
export const REFERENCE_LABEL_CATEGORIES = [
  'borders',
  'countries',
  'states',
  'cities',
  'towns',
  'water',
  'roads',
] as const;

export type ReferenceLabelCategory = (typeof REFERENCE_LABEL_CATEGORIES)[number];

export interface ReferenceLabelSettings {
  show: Record<ReferenceLabelCategory, boolean>;
  /** Fraction of white the text is drawn in, 0.5 to 1. */
  brightness: number;
  /** Multiplier on the reference style's text sizes. */
  sizeScale: number;
}

export const DEFAULT_REFERENCE_LABEL_SETTINGS: ReferenceLabelSettings = {
  show: {
    borders: true,
    countries: true,
    states: true,
    cities: true,
    towns: true,
    water: true,
    roads: true,
  },
  brightness: 1,
  sizeScale: 1,
};

/** The switch that governs a reference style layer, by its id; null for layers the overlay never shows. */
export function referenceLabelCategory(layerId: string): ReferenceLabelCategory | null {
  if (layerId.startsWith('boundary_')) return 'borders';
  if (layerId.startsWith('place_country')) return 'countries';
  if (layerId.startsWith('place_state')) return 'states';
  if (layerId.startsWith('place_city')) return 'cities';
  if (layerId.startsWith('place_')) return 'towns';
  if (layerId.startsWith('water_name')) return 'water';
  if (layerId.startsWith('highway_name_')) return 'roads';
  return null;
}
