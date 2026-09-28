/**
 * Satellite cloud overlay built from NASA GIBS geostationary infrared tiles.
 *
 * GIBS serves band 13 (10.3 µm) as a colour-enhanced, opaque image. Each tile
 * pixel is mapped back to its brightness temperature and redrawn as white
 * with an alpha that rises as the cloud tops get colder, so the basemap shows
 * through clear sky. Three satellites are merged per pixel, each longitude
 * taking the satellite whose sub-point is nearest.
 */
import { IR_COLORMAP } from './irColormap';

export const GIBS_WMTS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const GIBS_TILE_SIZE = 256;
export const GIBS_MAX_ZOOM = 6;

export interface GeoSatellite {
  layer: string;
  subLon: number;
}

export const GEO_SATELLITES: readonly GeoSatellite[] = [
  { layer: 'GOES-East_ABI_Band13_Clean_Infrared', subLon: -75.2 },
  { layer: 'GOES-West_ABI_Band13_Clean_Infrared', subLon: -137.2 },
  { layer: 'Himawari_AHI_Band13_Clean_Infrared', subLon: 140.7 },
];

/** Past this longitude offset the disk edge is too oblique to be useful. */
const MAX_VIEW_LON = 80;

/** Brightness temperatures (°C) where cloud alpha starts and saturates. */
const CLEAR_TEMP = 8;
const OPAQUE_TEMP = -35;

/**
 * The colormap has a grey band at -76..-70 °C that overlaps the warm grey
 * ramp, so a dark grey pixel is ambiguous. That band always sits between the
 * red and white-purple bands of a storm core, so a dark grey next to those
 * colours is read as cold.
 */
const AMBIGUOUS_GREY_MAX = 135;
const COLD_GREY_TEMP = -73;
const COLD_CORE_TEMP = -60;
const GREY_CHROMA = 12;
const COLD_NEIGHBOUR_RADIUS = 3;

export function gibsTileUrl(layer: string, z: number, x: number, y: number): string {
  return `${GIBS_WMTS_BASE}/${layer}/default/default/GoogleMapsCompatible_Level6/${z}/${y}/${x}.png`;
}

function lonDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function tileLonRange(z: number, x: number): [number, number] {
  const n = 2 ** z;
  return [(x / n) * 360 - 180, ((x + 1) / n) * 360 - 180];
}

/** Satellites whose usable disk overlaps any column of the tile. */
export function satellitesForTile(z: number, x: number): GeoSatellite[] {
  const [west, east] = tileLonRange(z, x);
  const span = east - west;
  return GEO_SATELLITES.filter((sat) => {
    const center = (west + east) / 2;
    return lonDelta(center, sat.subLon) <= MAX_VIEW_LON + span / 2;
  });
}

export function cloudAlpha(tempC: number): number {
  const t = (CLEAR_TEMP - tempC) / (CLEAR_TEMP - OPAQUE_TEMP);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

let tempLut: Float32Array | null = null;

/**
 * Nearest colormap temperature for every 15-bit RGB value. The reprojected
 * tiles blend neighbouring palette colours, so exact lookup misses a large
 * share of pixels. The ambiguous cold greys are left out and handled by the
 * neighbour check instead.
 */
function temperatureLut(): Float32Array {
  if (tempLut) return tempLut;
  const entries: { r: number; g: number; b: number; t: number }[] = [];
  for (let i = 0; i < IR_COLORMAP.length; i += 2) {
    const rgb = IR_COLORMAP[i] ?? 0;
    const t = IR_COLORMAP[i + 1] ?? 0;
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    if (r === g && g === b && t < -69 && t > -77) continue;
    entries.push({ r, g, b, t });
  }
  const lut = new Float32Array(32768);
  for (let key = 0; key < 32768; key++) {
    const r = ((key >> 10) << 3) | 4;
    const g = (((key >> 5) & 31) << 3) | 4;
    const b = ((key & 31) << 3) | 4;
    let best = Infinity;
    let bestT = 0;
    for (const e of entries) {
      const dr = r - e.r;
      const dg = g - e.g;
      const db = b - e.b;
      const d = dr * dr + dg * dg + db * db;
      if (d < best) {
        best = d;
        bestT = e.t;
      }
    }
    lut[key] = bestT;
  }
  tempLut = lut;
  return lut;
}

function dilate(mask: Uint8Array, size: number, radius: number): Uint8Array {
  const horiz = new Uint8Array(mask.length);
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let x = 0; x < size; x++) {
      if (!mask[row + x]) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(size - 1, x + radius);
      for (let k = x0; k <= x1; k++) horiz[row + k] = 1;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!horiz[y * size + x]) continue;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(size - 1, y + radius);
      for (let k = y0; k <= y1; k++) out[k * size + x] = 1;
    }
  }
  return out;
}

/**
 * Merge the satellites' RGBA tiles into one white cloud tile. `sources` lines
 * up with `satellites`; a null entry is a tile that failed to load.
 */
export function composeCloudTile(
  z: number,
  x: number,
  satellites: readonly GeoSatellite[],
  sources: readonly (Uint8ClampedArray | null)[],
  size = GIBS_TILE_SIZE
): Uint8ClampedArray {
  const lut = temperatureLut();
  const pixels = size * size;
  const temps = new Float32Array(pixels);
  const coverage = new Uint8Array(pixels);
  const coldCore = new Uint8Array(pixels);
  const ambiguous = new Uint8Array(pixels);

  const n = 2 ** z;
  for (let px = 0; px < size; px++) {
    const lon = ((x + (px + 0.5) / size) / n) * 360 - 180;
    const order = satellites
      .map((sat, i) => ({ i, d: lonDelta(lon, sat.subLon) }))
      .filter((s) => s.d <= MAX_VIEW_LON && sources[s.i])
      .sort((a, b) => a.d - b.d);

    for (let py = 0; py < size; py++) {
      const p = py * size + px;
      for (const { i } of order) {
        const src = sources[i] as Uint8ClampedArray;
        const o = p * 4;
        const a = src[o + 3] ?? 0;
        if (a < 128) continue;
        const r = src[o] ?? 0;
        const g = src[o + 1] ?? 0;
        const b = src[o + 2] ?? 0;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const t = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)] ?? 0;
        temps[p] = t;
        coverage[p] = a;
        if (chroma > GREY_CHROMA) {
          if (t <= COLD_CORE_TEMP) coldCore[p] = 1;
        } else if (r <= AMBIGUOUS_GREY_MAX) {
          ambiguous[p] = 1;
        }
        break;
      }
    }
  }

  const nearCold = dilate(coldCore, size, COLD_NEIGHBOUR_RADIUS);
  const out = new Uint8ClampedArray(pixels * 4);
  for (let p = 0; p < pixels; p++) {
    if (!coverage[p]) continue;
    const t = ambiguous[p] && nearCold[p] ? COLD_GREY_TEMP : (temps[p] ?? 0);
    const o = p * 4;
    out[o] = 255;
    out[o + 1] = 255;
    out[o + 2] = 255;
    out[o + 3] = Math.round(cloudAlpha(t) * (coverage[p] ?? 0));
  }
  return out;
}
