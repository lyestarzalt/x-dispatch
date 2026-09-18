import type { PopulatedPlace } from './cityLightsStyle';
import raw from './populatedPlaces.json';

/**
 * Natural Earth populated places, reduced to what the globe-zoom city
 * lights need. Regenerate with scripts/build-populated-places.mjs.
 */
export const POPULATED_PLACES = raw as unknown as readonly PopulatedPlace[];
