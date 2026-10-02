/**
 * Shared look for the drawn flight plan and procedure previews: one colour per leg kind
 * (enroute, SID, STAR, approach), a thick translucent stroke, and the pill image that carries
 * leg text on the line.
 */
import type * as maplibregl from 'maplibre-gl';
import type { RouteLegKind } from '@/lib/flightplan/builder/routeLine';
import { svgToDataUrl } from '@/lib/utils/helpers';

/** Line colour per leg kind. Enroute keeps the --violet token; procedures reuse the phase palette. */
export const ROUTE_KIND_COLORS: Record<RouteLegKind, string> = {
  enroute: '#8B5CF6',
  sid: '#22C55E',
  star: '#F59E0B',
  approach: '#06B6D4',
  missed: '#06B6D4',
};

export const ROUTE_LINE_WIDTH: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  5,
  8,
  8,
  12,
  11,
];
export const ROUTE_LINE_OPACITY = 0.6;
/** Thin outline under the line so it reads over satellite imagery. */
export const ROUTE_CASING_WIDTH: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  7,
  8,
  10,
  12,
  13,
];

/** `hex` mixed towards black by `amount` (0..1). */
export function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((n >> shift) & 0xff) * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** MapLibre match expression: the colour for a feature's `kind` property. */
export function kindColorExpression(
  fallback = ROUTE_KIND_COLORS.enroute
): maplibregl.ExpressionSpecification {
  return [
    'match',
    ['get', 'kind'],
    'sid',
    ROUTE_KIND_COLORS.sid,
    'star',
    ROUTE_KIND_COLORS.star,
    'approach',
    ROUTE_KIND_COLORS.approach,
    'missed',
    ROUTE_KIND_COLORS.missed,
    fallback,
  ];
}

export function procedureKind(type: 'SID' | 'STAR' | 'APPROACH' | 'ROUTE'): RouteLegKind {
  if (type === 'SID') return 'sid';
  if (type === 'STAR') return 'star';
  if (type === 'APPROACH') return 'approach';
  return 'enroute';
}

/** What a waypoint label belongs to; drives its badge colour. */
export type WaypointLabelKind = Exclude<RouteLegKind, 'missed'> | 'airport';

/** Badge colour per waypoint kind: a dark box for plain fixes, the line colours for procedure
 * fixes, --primary for the airports. */
export const LABEL_BADGE_COLORS: Record<WaypointLabelKind, string> = {
  enroute: '#1F2937',
  sid: ROUTE_KIND_COLORS.sid,
  star: ROUTE_KIND_COLORS.star,
  approach: ROUTE_KIND_COLORS.approach,
  airport: '#1DA0F2',
};

export function labelBadgeImageId(kind: WaypointLabelKind): string {
  return `route-badge-${kind}`;
}

/** The chip that carries leg text inside a line of this kind: the line colour, a shade darker. */
export function legChipImageId(kind: RouteLegKind): string {
  return `route-chip-${kind}`;
}

/** The badge for a plan waypoint: the airport, the procedure its `via` names, or plain enroute. */
export function waypointBadgeId(
  via: string,
  procedurePaths?: { via: string; kind?: 'sid' | 'star' | 'approach' }[]
): string {
  if (via === 'ADEP' || via === 'ADES') return labelBadgeImageId('airport');
  const proc = procedurePaths?.find((p) => p.via === via);
  return labelBadgeImageId(proc?.kind ?? 'enroute');
}

// The badge is drawn at 2x (64 x 40 px) and stretched to fit its text: the middle 24 px stretch
// horizontally, the middle 16 px vertically, and the text sits inside the content box, which
// leaves 2 px (1 css px) of padding - the layer adds the rest, so there is one knob for it.
const PILL_W = 64;
const PILL_H = 40;
const PILL_IMAGE_OPTIONS = {
  pixelRatio: 2,
  stretchX: [[20, 44]] as [number, number][],
  stretchY: [[12, 28]] as [number, number][],
  content: [2, 2, 62, 38] as [number, number, number, number],
};

function badgeSvg(color: string, radius: number, opacity: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PILL_W}" height="${PILL_H}" viewBox="0 0 ${PILL_W} ${PILL_H}"><rect x="0" y="0" width="${PILL_W}" height="${PILL_H}" rx="${radius}" ry="${radius}" fill="${color}" fill-opacity="${opacity}"/></svg>`;
}

function loadStretchImage(map: maplibregl.Map, id: string, svg: string): void {
  if (map.hasImage(id)) return;
  const img = new Image();
  img.onload = () => {
    if (!map.hasImage(id)) map.addImage(id, img, PILL_IMAGE_OPTIONS);
  };
  img.src = svgToDataUrl(svg);
}

/** Register the waypoint label badges and the in-line leg chips (idempotent; they appear when loaded). */
export function loadRouteLabelImages(map: maplibregl.Map): void {
  for (const kind of Object.keys(LABEL_BADGE_COLORS) as WaypointLabelKind[]) {
    loadStretchImage(map, labelBadgeImageId(kind), badgeSvg(LABEL_BADGE_COLORS[kind], 6, 0.95));
  }
  for (const kind of Object.keys(ROUTE_KIND_COLORS) as RouteLegKind[]) {
    loadStretchImage(
      map,
      legChipImageId(kind),
      badgeSvg(darken(ROUTE_KIND_COLORS[kind], 0.3), 20, 1)
    );
  }
}
