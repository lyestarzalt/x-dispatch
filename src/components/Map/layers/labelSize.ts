import type { ExpressionSpecification } from 'maplibre-gl';
import { EARTH_RADIUS_M, toRadians } from '@/lib/utils/geomath/sphere';
import type { Degrees, Meters } from '@/types/units';

/**
 * Label size that grows as the map zooms in, so navaid and waypoint text stays readable
 * when working an approach close up. Zoom 12 is roughly a 20 km wide view on a 2K screen.
 */
export function zoomScaledTextSize(base: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 7, base - 1, 10, base, 12, base + 2, 15, base + 5];
}

/** Ground metres one screen pixel covers at a latitude and zoom (512 px world tile at zoom 0). */
export function metersPerPixel(latitude: Degrees, zoom: number): Meters {
  const equator = 2 * Math.PI * EARTH_RADIUS_M;
  return (equator * Math.cos(toRadians(latitude))) / (512 * 2 ** zoom);
}

/** Average glyph advance of the label fonts as a share of the text size. */
const GLYPH_WIDTH_EM = 0.58;
/** Deepest zoom tested; a line still too short there never shows its text. */
const MAX_LABEL_ZOOM = 22;

/**
 * The first whole zoom at which text of `chars` characters is no longer than the line it is
 * written on, `sizeAt` giving the text size in pixels at a zoom. Text laid along a line must
 * not stick out past its ends, so it stays hidden until the line is long enough on screen.
 */
export function minZoomForTextOnLine(
  lineMeters: Meters,
  latitude: Degrees,
  chars: number,
  sizeAt: (zoom: number) => number
): number {
  for (let zoom = 0; zoom <= MAX_LABEL_ZOOM; zoom++) {
    const textPx = chars * GLYPH_WIDTH_EM * sizeAt(zoom);
    if (lineMeters / metersPerPixel(latitude, zoom) >= textPx) return zoom;
  }
  return MAX_LABEL_ZOOM + 1;
}
