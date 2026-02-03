import { SurfaceType } from '@/lib/aptParser/types';

/**
 * Surface type to color mapping for realistic airport visualization
 * Colors based on real-world airport surface appearances
 */
const SURFACE_COLORS: Record<number, string> = {
  // Standard X-Plane surface types
  [SurfaceType.ASPHALT]: '#2a2a2a', // Dark gray - aged asphalt
  [SurfaceType.CONCRETE]: '#a0a0a0', // Medium gray - concrete
  [SurfaceType.TURF_OR_GRASS]: '#3d6b35', // Natural green - grass
  [SurfaceType.DIRT]: '#8b6914', // Brown - dirt/earth
  [SurfaceType.GRAVEL]: '#9e9e9e', // Light gray - gravel
  [SurfaceType.DRY_LAKEBED]: '#c4a35a', // Sandy tan - dry lakebed
  [SurfaceType.WATER_RUNWAY]: '#1e5799', // Blue - water
  [SurfaceType.SNOW_OR_ICE]: '#e8e8e8', // Off-white - snow/ice
  [SurfaceType.TRANSPARENT]: 'transparent',

  // XP12 extended surface types (20-38)
  20: '#252525', // Fresh asphalt
  21: '#2f2f2f', // Worn asphalt
  22: '#3a3a3a', // Patched asphalt
  23: '#5e5e5e', // Fresh concrete
  24: '#707070', // Worn concrete
  25: '#7a7a7a', // Patched concrete
  26: '#3d6b35', // Dense grass
  27: '#4a7d40', // Normal grass
  28: '#5c8f4c', // Sparse grass
  29: '#7a5c3a', // Dry dirt
  30: '#8b6914', // Moist dirt
  31: '#a8a8a8', // Fine gravel
  32: '#8e8e8e', // Medium gravel
  33: '#787878', // Coarse gravel
  34: '#c4a35a', // Light dry lakebed
  35: '#b39550', // Dark dry lakebed
  36: '#d4d4d4', // Fresh snow
  37: '#c0c0c0', // Packed snow
  38: '#b8d4e8', // Ice

  // XP12 runway markings (50-57)
  50: '#2a2a2a', // Asphalt with markings
  51: '#6a6a6a', // Concrete with markings
  52: '#2a2a2a', // Dark asphalt variation
  53: '#333333', // Runway asphalt
  54: '#5a5a5a', // Taxiway concrete
  55: '#4a4a4a', // Apron asphalt
  56: '#656565', // Apron concrete
  57: '#2e2e2e', // High contrast runway
};

/**
 * All known X-Plane surface type codes
 * Used for MapLibre match expressions in runway/taxiway/pavement layers
 */
export const SURFACE_TYPES = [
  1, 2, 3, 4, 5, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  37, 38, 50, 51, 52, 53, 54, 55, 56, 57,
] as const;

/**
 * Get surface color with fallback to default
 */
export function getSurfaceColor(surfaceType: number): string {
  return SURFACE_COLORS[surfaceType] ?? '#3a3a3a';
}

/**
 * Surface outline colors (slightly lighter than fill)
 */
export function getSurfaceOutlineColor(surfaceType: number): string {
  const baseColor = getSurfaceColor(surfaceType);
  // For transparent, return no outline
  if (baseColor === 'transparent') return 'transparent';
  // Otherwise return a slightly lighter shade
  return lightenColor(baseColor, 15);
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}
