import { isRasterTileUrl } from './tileUrlToStyle';

/**
 * Hillshade over satellite imagery darkens a photo that already shows the relief, so on a
 * raster tile basemap shading is forced off. The user's preference is kept for vector styles.
 */
export function terrainShadingAllowed(mapStyleUrl: string): boolean {
  return !isRasterTileUrl(mapStyleUrl);
}
