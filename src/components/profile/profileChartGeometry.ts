/**
 * Pure geometry for the vertical profile chart: scales, ticks, SVG paths and the row under
 * the cursor. Paths are built once per data or size change; hovering only looks a row up.
 */

export interface ChartBox {
  width: number;
  height: number;
  /** Plot area inside the axes. */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Scales {
  x: (distanceNm: number) => number;
  y: (altitudeFt: number) => number;
  /** Distance under a pixel column, clamped to the plot. */
  invertX: (px: number) => number;
}

/** The stretch of the route on screen, NM from the start: `[from, to]`. */
export type Domain = readonly [number, number];

export function makeScales(box: ChartBox, domain: Domain, maxFt: number): Scales {
  const w = Math.max(1, box.right - box.left);
  const h = Math.max(1, box.bottom - box.top);
  const [from, to] = domain;
  const spanNm = to > from ? to - from : 1;
  const spanFt = maxFt > 0 ? maxFt : 1;
  return {
    x: (d) => box.left + ((d - from) / spanNm) * w,
    y: (a) => box.bottom - (a / spanFt) * h,
    invertX: (px) => Math.min(to, Math.max(from, from + ((px - box.left) / w) * spanNm)),
  };
}

/** Round ticks inside `[from, to]`, about `count` of them. */
export function ticksBetween(from: number, to: number, count: number): number[] {
  const step = niceStep(to - from, count);
  const out: number[] = [];
  const first = Math.ceil(from / step - 1e-9) * step;
  for (let v = first; v <= to + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Shortest stretch the chart zooms to: a few miles, or a fiftieth of a long route. */
export function minSpanNm(totalNm: number): number {
  return Math.min(totalNm, Math.max(5, totalNm / 200));
}

/** `domain` moved to lie inside the route, keeping its length. */
function clampDomain(from: number, span: number, totalNm: number): Domain {
  const start = Math.min(Math.max(0, from), Math.max(0, totalNm - span));
  return [start, start + span];
}

/**
 * Zoom by `factor` (below 1 zooms in) keeping `atNm` under the cursor. Returns null at the
 * whole route, the chart's own state for "not zoomed".
 */
export function zoomDomain(
  domain: Domain,
  totalNm: number,
  atNm: number,
  factor: number
): Domain | null {
  const [from, to] = domain;
  const span = Math.min(totalNm, Math.max(minSpanNm(totalNm), (to - from) * factor));
  if (span >= totalNm) return null;
  const share = to > from ? (atNm - from) / (to - from) : 0.5;
  return clampDomain(atNm - share * span, span, totalNm);
}

/** The same stretch moved by `deltaNm`, kept inside the route. */
export function panDomain(domain: Domain, totalNm: number, deltaNm: number): Domain {
  return clampDomain(domain[0] + deltaNm, domain[1] - domain[0], totalNm);
}

/** The same stretch centred on `atNm`, kept inside the route. */
export function centerDomain(domain: Domain, totalNm: number, atNm: number): Domain {
  const span = domain[1] - domain[0];
  return clampDomain(atNm - span / 2, span, totalNm);
}

/** Round tick spacing (1, 2, 2.5 or 5 x a power of ten) giving about `count` ticks. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || count < 1) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/** Ticks from 0 to `max` inclusive (the last one only when it lands on the step). */
export function ticks(max: number, count: number): number[] {
  const step = niceStep(max, count);
  const out: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

type Point = [number, number];

/** Points of one series, nulls skipped (the line joins across them). */
function seriesPoints<T>(
  rows: readonly T[],
  distance: (r: T) => number,
  value: (r: T) => number | null | undefined,
  s: Scales
): Point[] {
  const pts: Point[] = [];
  for (const r of rows) {
    const v = value(r);
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    pts.push([s.x(distance(r)), s.y(v)]);
  }
  return pts;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** A polyline through the series; empty when fewer than two points. */
export function linePath<T>(
  rows: readonly T[],
  distance: (r: T) => number,
  value: (r: T) => number | null | undefined,
  s: Scales
): string {
  const pts = seriesPoints(rows, distance, value, s);
  if (pts.length < 2) return '';
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`).join('');
}

/** The same line closed down to the baseline, for a filled area. */
export function areaPath<T>(
  rows: readonly T[],
  distance: (r: T) => number,
  value: (r: T) => number | null | undefined,
  s: Scales,
  baselineY: number
): string {
  const pts = seriesPoints(rows, distance, value, s);
  if (pts.length < 2) return '';
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const line = pts.map(([x, y]) => `L${fmt(x)},${fmt(y)}`).join('');
  return `M${fmt(first[0])},${fmt(baselineY)}${line}L${fmt(last[0])},${fmt(baselineY)}Z`;
}

/** A step line: each value holds until the next row's distance (leg safe altitudes). */
export function stepAfterPath<T>(
  rows: readonly T[],
  distance: (r: T) => number,
  value: (r: T) => number | null | undefined,
  s: Scales
): string {
  const pts = seriesPoints(rows, distance, value, s);
  if (pts.length < 2) return '';
  let d = `M${fmt(pts[0]![0])},${fmt(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    d += `H${fmt(x)}V${fmt(y)}`;
  }
  return d;
}

/** Index of the row nearest to `distanceNm` in rows sorted by distance; -1 when empty. */
export function nearestRowIndex<T>(
  rows: readonly T[],
  distance: (r: T) => number,
  distanceNm: number
): number {
  if (rows.length === 0) return -1;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (distance(rows[mid]!) < distanceNm) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && distanceNm - distance(rows[lo - 1]!) <= distance(rows[lo]!) - distanceNm) {
    return lo - 1;
  }
  return lo;
}
