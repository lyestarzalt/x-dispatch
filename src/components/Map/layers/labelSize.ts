import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * Label size that grows as the map zooms in, so navaid and waypoint text stays readable
 * when working an approach close up. Zoom 12 is roughly a 20 km wide view on a 2K screen.
 */
export function zoomScaledTextSize(base: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 7, base - 1, 10, base, 12, base + 2, 15, base + 5];
}
