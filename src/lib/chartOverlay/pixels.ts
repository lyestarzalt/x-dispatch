/**
 * Pixel work on a rendered chart page (RGBA, row by row), kept apart from the canvas so it
 * can be tested.
 */

/** How the chart is drawn: as printed on a light basemap, as a night sheet on a dark one. */
export type ChartInk = 'light' | 'dark';

/** The night sheet's paper: the panel's dark navy, so the chart sits with the dark basemaps. */
const NIGHT_PAPER = [14, 20, 30] as const;
/** The night sheet's ink: the panel foreground, a soft white. */
const NIGHT_INK = [235, 235, 235] as const;

const luma = (r: number, g: number, b: number) => (r * 299 + g * 587 + b * 114) / 1000;

/**
 * Turns the printed page into a night sheet, in place: white paper becomes dark, black ink
 * becomes light, and tints fall in between by how dark they were printed. The page stays
 * solid, so the map's opacity setting alone decides how much shows through.
 */
export function nightSheet(rgba: Uint8ClampedArray): void {
  for (let p = 0; p < rgba.length; p += 4) {
    const darkness = 1 - luma(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!) / 255;
    for (let k = 0; k < 3; k++) {
      rgba[p + k] = Math.round(NIGHT_PAPER[k]! + (NIGHT_INK[k]! - NIGHT_PAPER[k]!) * darkness);
    }
  }
}
