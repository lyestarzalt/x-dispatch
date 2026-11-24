import type { LonLat } from '@/types/geo';

/**
 * The map position an FAA approach chart carries inside its PDF: a viewport box on the page
 * and the latitude/longitude of four points in it (the PDF "geospatial measure" dictionary,
 * `/VP [ << /BBox [...] /Measure << /GPTS [...] /LPTS [...] >> >> ]`). Approach charts have
 * one; airport diagrams, SIDs and STARs do not.
 *
 * Page lengths here are PDF points (1/72 inch), a unit `types/units.ts` does not carry.
 */
export interface PdfGeoreference {
  /** Page size in PDF points. */
  page: { width: number; height: number };
  /** The georeferenced box on the page in PDF points, origin at the page's bottom-left. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /**
   * Where the four reference points sit in the box (0 to 1 from its bottom-left) and the
   * position each stands for. The FAA puts them at 0.1 and 0.9 of the box.
   */
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** `[lon, lat]` at (u0,v0), (u1,v0), (u1,v1), (u0,v1). */
  positions: [LonLat, LonLat, LonLat, LonLat];
}

/** A rectangle on the page in PDF points, origin at the page's top-left as a renderer draws it. */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const numbers = (list: string | undefined): number[] =>
  (list ?? '')
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));

const NEAR = 1e-6;

/**
 * Reads the georeference out of a PDF's bytes, or null when the file has none or has one this
 * reader does not place (a rotated page, reference points that are not the corners of a box).
 */
export function parsePdfGeoreference(bytes: Uint8Array): PdfGeoreference | null {
  // The dictionary is plain text in the page object; latin1 keeps one character per byte.
  const text = new TextDecoder('latin1').decode(bytes);
  const viewport = text.indexOf('/VP');
  if (viewport < 0) return null;
  const tail = text.slice(viewport, viewport + 8000);

  const bbox = numbers(/\/BBox\s*\[([^\]]*)\]/.exec(tail)?.[1]);
  const gpts = numbers(/\/GPTS\s*\[([^\]]*)\]/.exec(tail)?.[1]);
  const lpts = numbers(/\/LPTS\s*\[([^\]]*)\]/.exec(tail)?.[1]);
  const media = numbers(/\/MediaBox\s*\[([^\]]*)\]/.exec(text)?.[1]);
  if (bbox.length !== 4 || gpts.length !== 8 || lpts.length !== 8 || media.length !== 4) {
    return null;
  }
  const rotation = Number(/\/Rotate\s+(-?\d+)/.exec(text)?.[1] ?? 0);
  if (rotation % 360 !== 0) return null;

  const [u0, v0, u1, , , v1] = lpts as [number, number, number, number, number, number];
  // The four points must be the corners of a box, in the order the FAA writes them:
  // bottom-left, bottom-right, top-right, top-left.
  const expected = [u0, v0, u1, v0, u1, v1, u0, v1];
  if (lpts.some((value, i) => Math.abs(value - expected[i]!) > NEAR)) return null;
  if (u1 - u0 < NEAR || v1 - v0 < NEAR) return null;

  // GPTS is latitude then longitude.
  const position = (i: number): LonLat => [gpts[i * 2 + 1]!, gpts[i * 2]!];
  const positions: PdfGeoreference['positions'] = [
    position(0),
    position(1),
    position(2),
    position(3),
  ];
  if (positions.some(([lon, lat]) => Math.abs(lat) > 90 || Math.abs(lon) > 180)) return null;

  const [mx0, my0, mx1, my1] = media as [number, number, number, number];
  const [x0, y0, x1, y1] = bbox as [number, number, number, number];
  if (x1 - x0 < NEAR || y1 - y0 < NEAR) return null;
  return {
    page: { width: mx1 - mx0, height: my1 - my0 },
    bbox: { x0: x0 - mx0, y0: y0 - my0, x1: x1 - mx0, y1: y1 - my0 },
    u0,
    u1,
    v0,
    v1,
    positions,
  };
}

/**
 * The position of a point on the page, given in PDF points from the page's top-left. Between
 * the reference points this interpolates; beyond them it continues the same grid, which is
 * what places the page's margins.
 */
export function pagePointToLonLat(geo: PdfGeoreference, x: number, y: number): LonLat {
  const { bbox, positions } = geo;
  const u = (x - bbox.x0) / (bbox.x1 - bbox.x0);
  const v = (geo.page.height - y - bbox.y0) / (bbox.y1 - bbox.y0);
  const s = (u - geo.u0) / (geo.u1 - geo.u0);
  const t = (v - geo.v0) / (geo.v1 - geo.v0);
  const [bl, br, tr, tl] = positions;
  const blend = (k: 0 | 1) =>
    (1 - s) * (1 - t) * bl[k] + s * (1 - t) * br[k] + s * t * tr[k] + (1 - s) * t * tl[k];
  return [blend(0), blend(1)];
}

/**
 * The four map corners of a rectangle on the page, in the order a MapLibre image or canvas
 * source takes them: top-left, top-right, bottom-right, bottom-left.
 */
export function pageRectCorners(
  geo: PdfGeoreference,
  rect: PageRect
): [LonLat, LonLat, LonLat, LonLat] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return [
    pagePointToLonLat(geo, rect.x, rect.y),
    pagePointToLonLat(geo, right, rect.y),
    pagePointToLonLat(geo, right, bottom),
    pagePointToLonLat(geo, rect.x, bottom),
  ];
}
