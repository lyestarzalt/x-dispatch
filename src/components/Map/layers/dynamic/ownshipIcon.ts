/**
 * Own-aircraft map symbol.
 *
 * The symbol is the silhouette of the aircraft type being flown, from the
 * same shape set the traffic layers use, in the pilot's colour with a black
 * edge. It is rendered once into a canvas, so it stays crisp at any heading
 * and reads on every basemap, and MapLibre draws it at a fixed on-screen
 * size like every EFB. No SDF: the outline is in the pixels.
 *
 * Shapes are fetched, so each one arrives a moment after the layer is
 * built. Until then the layer shows a placeholder drawn in code: a plain
 * airplane, or a helicopter body with its rotor. A type with no shape keeps
 * the generic airplane silhouette, or the drawn helicopter.
 */

export type OwnshipIconKind = 'airplane' | 'helicopter';

export const OWNSHIP_ICON_ID: Record<OwnshipIconKind, string> = {
  airplane: 'ownship-airplane',
  helicopter: 'ownship-helicopter',
};

/** One registered image per placeholder symbol and colour scheme, so switching schemes never redraws an image a layer still uses. */
export function ownshipIconId(kind: OwnshipIconKind, scheme: OwnshipColorScheme): string {
  return `${OWNSHIP_ICON_ID[kind]}-${scheme}`;
}

/** The shape set's generic airplane, used when the type flown has no silhouette. */
export const GENERIC_SHAPE = 'Unidentified';

/** One registered image per aircraft-type silhouette and colour scheme. */
export function ownshipShapeIconId(shape: string, scheme: OwnshipColorScheme): string {
  return `ownship-shape-${shape}-${scheme}`;
}

/** The silhouette's shadow on the ground. */
export function ownshipShapeShadowId(shape: string): string {
  return `ownship-shape-${shape}-shadow`;
}

/** On-screen size of the symbol in CSS pixels, the same at every zoom. */
export type OwnshipSize = 'small' | 'medium' | 'large';
export const OWNSHIP_SIZES: readonly OwnshipSize[] = ['small', 'medium', 'large'];
export const OWNSHIP_SIZE_PX: Record<OwnshipSize, number> = { small: 32, medium: 44, large: 60 };

export interface OwnshipStyle {
  size: OwnshipSize;
  color: OwnshipColorScheme;
  /** Ground shadow that drifts away from the symbol with height above ground. */
  altitudeCues: boolean;
}

export const DEFAULT_OWNSHIP_STYLE: OwnshipStyle = {
  size: 'medium',
  color: 'magenta',
  altitudeCues: true,
};

/** The placeholder symbol's shadow on the ground, one per kind. */
export function ownshipShadowId(kind: OwnshipIconKind): string {
  return `${OWNSHIP_ICON_ID[kind]}-shadow`;
}

/** Canvas edge in CSS pixels; the symbol fills it with a small margin for the outline. */
export const OWNSHIP_ICON_SIZE = 64;
export const OWNSHIP_ICON_PIXEL_RATIO = 2;
/** Outline width in CSS pixels at the canvas size; the layer scales the whole sprite down. */
const EDGE_WIDTH = 2.4;
/** Blank border inside the canvas so the outline never clips. */
const MARGIN = 3;

/**
 * Colour schemes the pilot can pick. Online traffic is green (VATSIM) and
 * blue (IVAO), and the sim's own traffic amber, so none of these is close to
 * any of them; each is a light body with a black edge.
 */
export type OwnshipColorScheme = 'white' | 'magenta' | 'red';
export const OWNSHIP_COLOR_SCHEMES: readonly OwnshipColorScheme[] = ['white', 'magenta', 'red'];

export interface OwnshipColors {
  fill: string;
  edge: string;
  /** The anchor ring and data label. */
  accent: string;
}

const BLACK = '#000000';
const WHITE = '#F8FAFC';
// Farthest in OKLab from every ground, traffic colour and chart marking the map shows.
const MAGENTA = '#E040FB';
const RED = '#EF4444';
const SHADOW_COLORS: OwnshipColors = { fill: BLACK, edge: BLACK, accent: BLACK };

export const OWNSHIP_COLORS: Record<OwnshipColorScheme, OwnshipColors> = {
  white: { fill: WHITE, edge: BLACK, accent: WHITE },
  magenta: { fill: MAGENTA, edge: BLACK, accent: MAGENTA },
  red: { fill: RED, edge: BLACK, accent: RED },
};

/** The scheme's colours, or the default's for a value saved by an older build. */
export function ownshipColors(scheme: string): OwnshipColors {
  return (
    OWNSHIP_COLORS[scheme as OwnshipColorScheme] ?? OWNSHIP_COLORS[DEFAULT_OWNSHIP_STYLE.color]
  );
}

export function isOwnshipColorScheme(value: unknown): value is OwnshipColorScheme {
  return typeof value === 'string' && value in OWNSHIP_COLORS;
}

type Point = readonly [number, number];

/** Right half of the placeholder airplane, nose up, in a 0..1 box; mirrored to close the polygon. */
const AIRPLANE_RIGHT_HALF: readonly Point[] = [
  [0.5, 0.03],
  [0.555, 0.12],
  [0.56, 0.36],
  [0.96, 0.57],
  [0.97, 0.64],
  [0.56, 0.56],
  [0.55, 0.8],
  [0.72, 0.9],
  [0.72, 0.95],
  [0.52, 0.91],
  [0.5, 0.98],
];

/** Full closed outline, right half then the mirrored left half walking back up. */
export function airplaneOutline(): Point[] {
  const right = AIRPLANE_RIGHT_HALF;
  const left = right
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [1 - x, y] as Point);
  return [...right, ...left];
}

/**
 * The helicopter body seen from above, nose up: cabin, boom, skids and
 * tail. Its own path, since the shape set covers only a few types. The
 * box below is its extent together with the rotor.
 */
const HELICOPTER_BODY =
  'm 4.5262285,1.0018037 -0.637168,0.212389 -0.232617,0.586598 -0.0708,0.728193 0.02022,0.202275 -0.141593,-0.01012 -0.02023,-0.627054 -0.121366,0.01012 0.06069,3.206066 0.09102,-0.01011 -0.01012,-0.202275 0.141593,0.02023 0.101139,0.869784 0.303413,0.839444 0.242732,0.353982 0.0809,2.235144 -1.345135,-0.02023 -0.121366,0.8293303 h 0.13148 l 0.04046,-0.2326173 h 1.264223 l 0.121365,1.5676363 0.121367,0.525916 0.192161,-0.02023 0.05057,-2.0834383 1.213654,0.01011 0.01011,0.2326183 0.111252,0.01011 0.09102,-0.8394433 -1.405817,0.01012 -0.03033,-2.265486 0.303414,-0.374209 0.273072,-0.707965 0.06069,-1.001263 h 0.13148 l 0.01012,0.24273 0.161821,0.02023 -0.04046,-1.517067 v -1.689001 l -0.131479,-0.03034 v 0.627054 l -0.161821,0.02023 -0.05057,-0.849556 -0.202276,-0.566372 -0.21239,-0.202276 z';
const HELICOPTER_ROTOR = { cx: 4.5, cy: 3.6, radius: 3.6, width: 0.4, angleDeg: 40 };
const HELICOPTER_BOX = { x: 0.6, y: -0.4, w: 7.8, h: 12.6 };

export interface OwnshipIconImage {
  width: number;
  height: number;
  data: Uint8Array;
  pixelRatio: number;
}

function tracePolygon(ctx: CanvasRenderingContext2D, pts: readonly Point[], s: number): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * s, y * s) : ctx.lineTo(x * s, y * s)));
  ctx.closePath();
}

function drawAirplane(ctx: CanvasRenderingContext2D, s: number): void {
  tracePolygon(ctx, airplaneOutline(), s);
  ctx.fill();
  ctx.stroke();
}

/** Edge pass under the fill pass: a clean outside outline, and inner detail lines never show. */
function strokeThenFill(ctx: CanvasRenderingContext2D, draw: () => void): void {
  draw();
  ctx.stroke();
  draw();
  ctx.fill();
}

function drawHelicopter(ctx: CanvasRenderingContext2D, px: number): void {
  const inner = px - 2 * MARGIN * OWNSHIP_ICON_PIXEL_RATIO;
  const scale = Math.min(inner / HELICOPTER_BOX.w, inner / HELICOPTER_BOX.h);
  const tx = (px - HELICOPTER_BOX.w * scale) / 2 - HELICOPTER_BOX.x * scale;
  const ty = (px - HELICOPTER_BOX.h * scale) / 2 - HELICOPTER_BOX.y * scale;
  const body = new Path2D(HELICOPTER_BODY);
  const { cx, cy, radius, width, angleDeg } = HELICOPTER_ROTOR;

  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);
  ctx.lineWidth = (EDGE_WIDTH * OWNSHIP_ICON_PIXEL_RATIO) / scale;
  // Rotor blades under the cabin, then the body on top.
  strokeThenFill(ctx, () => {
    ctx.beginPath();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.roundRect(-radius, -width / 2, radius * 2, width, width / 2);
    ctx.roundRect(-width / 2, -radius, width, radius * 2, width / 2);
    ctx.restore();
  });
  ctx.stroke(body);
  ctx.fill(body);
  ctx.restore();
}

/**
 * Rasterise a placeholder symbol. Returns a transparent image when no 2D
 * canvas is available (unit tests run in Node) so the layer can still be built.
 */
export function createOwnshipIcon(
  kind: OwnshipIconKind,
  scheme: OwnshipColorScheme = 'magenta'
): OwnshipIconImage {
  return renderOwnship(kind, ownshipColors(scheme));
}

/** The placeholder symbol as a flat black silhouette, drawn on the ground under the aircraft. */
export function createOwnshipShadow(kind: OwnshipIconKind): OwnshipIconImage {
  return renderOwnship(kind, SHADOW_COLORS);
}

function blankImage(): OwnshipIconImage {
  const px = OWNSHIP_ICON_SIZE * OWNSHIP_ICON_PIXEL_RATIO;
  return {
    width: px,
    height: px,
    data: new Uint8Array(px * px * 4),
    pixelRatio: OWNSHIP_ICON_PIXEL_RATIO,
  };
}

function renderOwnship(kind: OwnshipIconKind, colors: OwnshipColors): OwnshipIconImage {
  const blank = blankImage();
  if (typeof document === 'undefined') return blank;
  const px = blank.width;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blank;

  ctx.fillStyle = colors.fill;
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = EDGE_WIDTH * OWNSHIP_ICON_PIXEL_RATIO;
  ctx.lineJoin = 'round';
  if (kind === 'helicopter') drawHelicopter(ctx, px);
  else drawAirplane(ctx, px);

  return {
    ...blank,
    data: new Uint8Array(ctx.getImageData(0, 0, px, px).data.buffer),
  };
}

// ---------------------------------------------------------------------------
// Aircraft-type silhouettes from the shape set
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The shape's drawable elements as markup, hidden layers and editor metadata dropped, plus its extent. */
function prepareShape(svgText: string): { body: string; box: DOMRect } | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  doc.querySelectorAll('metadata, namedview, title, defs, text').forEach((el) => el.remove());
  doc.querySelectorAll('g').forEach((g) => {
    if (g.getAttribute('style')?.includes('display:none')) g.remove();
  });
  const shapes = doc.querySelectorAll('g, path, polygon, polyline, circle, ellipse, rect, line');
  shapes.forEach((el) => {
    for (const attr of ['style', 'fill', 'stroke', 'stroke-width', 'id', 'class']) {
      el.removeAttribute(attr);
    }
  });

  // Measure in the live document: getBBox needs a rendered tree.
  const probe = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
  probe.setAttribute('width', '1');
  probe.setAttribute('height', '1');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const box = probe.getBBox();
  document.body.removeChild(probe);
  if (!(box.width > 0) || !(box.height > 0)) return null;

  const body = Array.from(doc.documentElement.children)
    .map((el) => new XMLSerializer().serializeToString(el))
    .join('');
  return { body, box };
}

/**
 * Rasterise an aircraft-type silhouette: the shape fitted to the canvas,
 * edge pass under fill pass so the outline sits outside the body. Resolves
 * null outside the browser or when the SVG cannot be drawn.
 */
export function createOwnshipShapeIcon(
  svgText: string,
  colors: OwnshipColors
): Promise<OwnshipIconImage | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const prepared = prepareShape(svgText);
  if (!prepared) return Promise.resolve(null);
  const { body, box } = prepared;

  const inner = OWNSHIP_ICON_SIZE - 2 * MARGIN;
  const unitsPerCssPx = Math.max(box.width, box.height) / inner;
  const edge = EDGE_WIDTH * unitsPerCssPx;
  const side = Math.max(box.width, box.height) + 2 * MARGIN * unitsPerCssPx;
  const x = box.x + box.width / 2 - side / 2;
  const y = box.y + box.height / 2 - side / 2;
  const px = OWNSHIP_ICON_SIZE * OWNSHIP_ICON_PIXEL_RATIO;
  const markup =
    `<svg xmlns="${SVG_NS}" width="${px}" height="${px}" viewBox="${x} ${y} ${side} ${side}">` +
    `<g fill="${colors.edge}" stroke="${colors.edge}" stroke-width="${edge}" stroke-linejoin="round">${body}</g>` +
    `<g fill="${colors.fill}" stroke="none">${body}</g></svg>`;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image(px, px);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, px, px);
      resolve({
        ...blankImage(),
        data: new Uint8Array(ctx.getImageData(0, 0, px, px).data.buffer),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** The silhouette as a flat black shadow. */
export function createOwnshipShapeShadow(svgText: string): Promise<OwnshipIconImage | null> {
  return createOwnshipShapeIcon(svgText, SHADOW_COLORS);
}
