/**
 * Airway routing between two airports. Main process only.
 *
 * The airway table stores fix names, not positions, so the graph is built per
 * request from the fixes inside a box around the great circle. A* over
 * great-circle distance finds the cheapest path, where cost is miles plus the
 * rules that make a route look filed rather than merely short:
 *
 * - segments whose published level band excludes the cruise level cost more
 * - the network is joined at published SID exits and STAR entries when known
 * - fixes in either terminal area are avoided unless they are the join fix
 * - one-way airways are honoured and airway changes cost a few miles
 * - segments through active prohibited or restricted airspace cost double
 *
 * Free route airspace leaves gaps in the airway table, so when airways alone
 * give nothing or only a long detour, a second pass allows direct legs between
 * airway fixes, the way FRA routes are filed.
 */
import {
  getAirspacesInBounds,
  getAllAirwaysFromDb,
  getNavaidsInBounds,
  getWaypointsInBounds,
} from '@/lib/xplaneServices/dataService/navdata/navCache';
import type { Airspace, AirwaySegment } from '@/types/navigation';
import { type LatLon, greatCircleNm } from './geometry';
import type { AutoRouteResult, ProcedureChoice, RouteJoin } from './types';

/** Box padding around the endpoints; wide enough to let the route bend round gaps. */
const MIN_PADDING_NM = 150;
const PADDING_FRACTION = 0.25;
/**
 * Without published joins, direct legs onto and off the network are allowed this far
 * and cost double, so the router still prefers to pick up an airway early.
 */
const JOIN_RADIUS_NM = 80;
const JOIN_PENALTY = 2;
/** Fallback when nothing is inside the join radius: still connect the nearest few fixes. */
const JOIN_FALLBACK_COUNT = 5;
/** Airways of the wrong altitude family cost a little more so a jet stays on the upper network. */
const WRONG_FAMILY_PENALTY = 1.15;
/** A segment whose published level band excludes the cruise level costs this much more. */
const OUT_OF_BAND_PENALTY = 1.6;
const HIGH_FAMILY_MIN_FT = 18000;
/** Switching airway costs a few miles so the route reads as a handful of long airways. */
const AIRWAY_CHANGE_PENALTY_NM = 15;
/**
 * Fixes this close to either airport belong to arrivals and departures, not the enroute
 * part. On a short hop the area shrinks so the middle of the leg stays usable.
 */
const TERMINAL_AREA_NM = 30;
const TERMINAL_AREA_MAX_SHARE = 0.25;
const TERMINAL_PENALTY = 1.25;
/** A strict result longer than this share of the direct distance triggers the relaxed pass. */
const MAX_DETOUR_FACTOR = 1.3;
const MAX_DETOUR_SLACK_NM = 40;
/** Relaxed pass: direct legs between airway fixes only, a handful of neighbours each. */
const DIRECT_LEG_NM = 100;
const DIRECT_NEIGHBOURS = 6;
const DIRECT_PENALTY = 1.2;
/**
 * Prohibited areas are routed round where the network allows. Restricted areas are
 * crossed by published airways all the time, so they only nudge.
 */
const AIRSPACE_PENALTY: Partial<Record<Airspace['class'], number>> = { P: 2, R: 1.15 };

/** Only en-route navaids sit on airways; ILS, glideslope and markers are noise here. */
const AIRWAY_NAVAID_TYPES = ['VOR', 'NDB', 'DME', 'VOR-DME', 'VORTAC', 'TACAN'];
/** A continental leg can box in well over the default 5000 fixes. */
const FIX_QUERY_LIMIT = 200000;
const AIRSPACE_QUERY_LIMIT = 5000;

const START = '@start';
const END = '@end';
const JOIN_PREFIX = '@join/';

interface Edge {
  to: string;
  weight: number;
  airway: string | null;
}

interface RouteStep {
  fixId: string;
  airway: string | null;
}

export interface AutoRouteInput {
  /** The airports, for the terminal-area rule. */
  departure: LatLon;
  arrival: LatLon;
  /** Where the enroute part starts and ends: a fixed SID exit or STAR entry, else the airports. */
  from: LatLon;
  to: LatLon;
  /** Candidate joins when no procedure is fixed yet; the router picks the pair that routes best. */
  exits?: RouteJoin[];
  entries?: RouteJoin[];
  cruiseAltitudeFt: number | null;
  /** Receives one line per pass, for the main log. */
  trace?: (message: string) => void;
}

let cachedSegments: AirwaySegment[] | null = null;

/** Airway segments rarely change within a session; loading them is the expensive part. */
function loadSegments(): AirwaySegment[] {
  if (!cachedSegments) cachedSegments = getAllAirwaysFromDb();
  return cachedSegments;
}

export function invalidateAutoRouterCache(): void {
  cachedSegments = null;
}

class MinHeap {
  private items: { key: string; cost: number }[] = [];

  push(key: string, cost: number): void {
    this.items.push({ key, cost });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent]!.cost <= this.items[i]!.cost) break;
      [this.items[parent], this.items[i]] = [this.items[i]!, this.items[parent]!];
      i = parent;
    }
  }

  pop(): { key: string; cost: number } | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.items[l]!.cost < this.items[smallest]!.cost) smallest = l;
        if (r < this.items.length && this.items[r]!.cost < this.items[smallest]!.cost) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i]!, this.items[smallest]!];
        i = smallest;
      }
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * Collapses a fix-by-fix path into filing form. Consecutive legs on the same
 * airway keep only their first and last fix; direct legs are written with DCT.
 */
export function compressPath(steps: RouteStep[]): string {
  const out: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const arriving = i === 0 ? null : steps[i - 1]!.airway;
    const isLast = i === steps.length - 1;
    // A fix is filed where the airway changes, including onto or off a direct leg.
    const boundary = i === 0 || isLast || arriving === null || arriving !== step.airway;
    if (!boundary) continue;
    out.push(step.fixId);
    if (!isLast) out.push(step.airway ?? 'DCT');
  }
  return out.join(' ');
}

function fixKey(id: string, region: string): string {
  return `${id}/${region}`;
}

// ----------------------------------------------------------------------------
// Airspace
// ----------------------------------------------------------------------------

/** "FL195", "5000ft", "GND", "UNL" and friends to feet; null when unreadable. */
export function limitToFeet(text: string): number | null {
  const s = text.trim().toUpperCase();
  if (s === 'GND' || s === 'SFC' || s === 'MSL' || s === '0') return 0;
  if (s === 'UNL' || s === 'UNLTD' || s === 'UNLIMITED') return Infinity;
  const fl = /^FL\s*(\d+)/.exec(s);
  if (fl) return Number(fl[1]) * 100;
  const ft = /^(\d+)\s*(FT|F|')?/.exec(s);
  if (ft) return Number(ft[1]);
  return null;
}

interface AvoidArea {
  ring: [number, number][];
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  penalty: number;
}

function avoidAreasAtLevel(spaces: Airspace[], cruiseFt: number): AvoidArea[] {
  const out: AvoidArea[] = [];
  for (const a of spaces) {
    const penalty = AIRSPACE_PENALTY[a.class];
    if (!penalty || a.coordinates.length < 3) continue;
    const floor = limitToFeet(a.lowerLimit) ?? 0;
    const ceiling = limitToFeet(a.upperLimit) ?? Infinity;
    if (cruiseFt < floor || cruiseFt > ceiling) continue;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const [lon, lat] of a.coordinates) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    out.push({ ring: a.coordinates, minLat, maxLat, minLon, maxLon, penalty });
  }
  return out;
}

function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** True when the leg starts, ends or passes inside the area. */
export function legCrossesArea(a: LatLon, b: LatLon, area: AvoidArea): boolean {
  const minLat = Math.min(a.latitude, b.latitude);
  const maxLat = Math.max(a.latitude, b.latitude);
  const minLon = Math.min(a.longitude, b.longitude);
  const maxLon = Math.max(a.longitude, b.longitude);
  if (maxLat < area.minLat || minLat > area.maxLat) return false;
  if (maxLon < area.minLon || minLon > area.maxLon) return false;
  if (pointInRing(a.longitude, a.latitude, area.ring)) return true;
  if (pointInRing(b.longitude, b.latitude, area.ring)) return true;
  const ring = area.ring;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [cx, cy] = ring[i]!;
    const [dx, dy] = ring[j]!;
    if (segmentsCross(a.longitude, a.latitude, b.longitude, b.latitude, cx, cy, dx, dy)) {
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------------------
// Graph
// ----------------------------------------------------------------------------

interface Graph {
  positions: Map<string, LatLon>;
  edges: Map<string, Edge[]>;
  /** Fix keys inside either terminal area. */
  terminal: Set<string>;
}

function addEdge(graph: Graph, from: string, to: string, weight: number, airway: string | null) {
  if (!graph.edges.has(from)) graph.edges.set(from, []);
  graph.edges.get(from)!.push({ to, weight, airway });
}

/**
 * Whether the published level band covers the cruise level. Bands with no data
 * count as open. Kept a penalty rather than a cut: a single out-of-band segment
 * would otherwise sever a continent-wide network.
 */
export function bandAllows(segment: AirwaySegment, cruiseFl: number): boolean {
  if (segment.baseFl === 0 && segment.topFl === 0) return true;
  if (segment.baseFl > cruiseFl) return false;
  return segment.topFl === 0 || segment.topFl >= cruiseFl;
}

interface BuildOptions {
  /** Direct legs between airway fixes, for free route airspace. */
  direct: boolean;
}

function buildGraph(input: AutoRouteInput, opts: BuildOptions): Graph | null {
  const { departure, arrival, from, to } = input;
  const totalNm = greatCircleNm(from, to);
  const padNm = Math.max(MIN_PADDING_NM, totalNm * PADDING_FRACTION);
  const padLat = padNm / 60;
  const midLat = (from.latitude + to.latitude) / 2;
  const padLon = padNm / (60 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  const minLat =
    Math.min(from.latitude, to.latitude, departure.latitude, arrival.latitude) - padLat;
  const maxLat =
    Math.max(from.latitude, to.latitude, departure.latitude, arrival.latitude) + padLat;
  const minLon =
    Math.min(from.longitude, to.longitude, departure.longitude, arrival.longitude) - padLon;
  const maxLon =
    Math.max(from.longitude, to.longitude, departure.longitude, arrival.longitude) + padLon;

  // Airways name fixes by ICAO region. The fix tables keep that code in `areaCode`
  // (waypoints) and `country` (navaids); their `region` column is the ENRT marker.
  const positions = new Map<string, LatLon>();
  for (const wp of getWaypointsInBounds(minLat, maxLat, minLon, maxLon, FIX_QUERY_LIMIT)) {
    positions.set(fixKey(wp.id, wp.areaCode), { latitude: wp.latitude, longitude: wp.longitude });
  }
  for (const nav of getNavaidsInBounds(
    minLat,
    maxLat,
    minLon,
    maxLon,
    AIRWAY_NAVAID_TYPES,
    FIX_QUERY_LIMIT
  )) {
    const key = fixKey(nav.id, nav.country);
    if (!positions.has(key)) {
      positions.set(key, { latitude: nav.latitude, longitude: nav.longitude });
    }
  }
  if (positions.size === 0) return null;

  const terminalNm = Math.min(TERMINAL_AREA_NM, totalNm * TERMINAL_AREA_MAX_SHARE);
  const terminal = new Set<string>();
  for (const [key, p] of positions) {
    if (greatCircleNm(p, departure) <= terminalNm || greatCircleNm(p, arrival) <= terminalNm) {
      terminal.add(key);
    }
  }

  const cruiseFt = input.cruiseAltitudeFt ?? HIGH_FAMILY_MIN_FT;
  const cruiseFl = Math.round(cruiseFt / 100);
  const preferHigh = cruiseFt >= HIGH_FAMILY_MIN_FT;
  const avoid = avoidAreasAtLevel(
    getAirspacesInBounds(minLat, maxLat, minLon, maxLon, AIRSPACE_QUERY_LIMIT),
    cruiseFt
  );

  const graph: Graph = { positions, edges: new Map(), terminal };
  for (const s of loadSegments()) {
    const a = fixKey(s.fromFix, s.fromRegion);
    const b = fixKey(s.toFix, s.toRegion);
    const pa = positions.get(a);
    const pb = positions.get(b);
    if (!pa || !pb) continue;
    let weight = greatCircleNm(pa, pb) * (s.isHigh === preferHigh ? 1 : WRONG_FAMILY_PENALTY);
    if (!bandAllows(s, cruiseFl)) weight *= OUT_OF_BAND_PENALTY;
    for (const area of avoid) {
      if (legCrossesArea(pa, pb, area)) {
        weight *= area.penalty;
        break;
      }
    }
    // A segment shared by several airways is stored as "A31-A411": one edge per airway,
    // so the path can stay on whichever name it arrived on.
    for (const name of s.name.split('-')) {
      // direction: 0 both ways, 1 forward only, 2 backward only
      if (s.direction !== 2) addEdge(graph, a, b, weight, name);
      if (s.direction !== 1) addEdge(graph, b, a, weight, name);
    }
  }

  if (opts.direct) addDirectLegs(graph);
  return graph;
}

/**
 * Relaxed pass only: direct legs between fixes that sit on an airway, found
 * through a degree grid. Terminal and approach fixes are not airway nodes, so
 * they never become shortcuts.
 */
function addDirectLegs(graph: Graph): void {
  const nodes = [...graph.edges.keys()];
  const cells = new Map<string, string[]>();
  const cellOf = (p: LatLon) => `${Math.floor(p.latitude)}:${Math.floor(p.longitude)}`;
  for (const key of nodes) {
    const c = cellOf(graph.positions.get(key)!);
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c)!.push(key);
  }
  for (const key of nodes) {
    const p = graph.positions.get(key)!;
    const lat = Math.floor(p.latitude);
    const lon = Math.floor(p.longitude);
    const near: { key: string; nm: number }[] = [];
    for (let dl = -2; dl <= 2; dl++) {
      for (let dn = -2; dn <= 2; dn++) {
        for (const other of cells.get(`${lat + dl}:${lon + dn}`) ?? []) {
          if (other === key) continue;
          const nm = greatCircleNm(p, graph.positions.get(other)!);
          if (nm <= DIRECT_LEG_NM) near.push({ key: other, nm });
        }
      }
    }
    near.sort((x, y) => x.nm - y.nm);
    for (const n of near.slice(0, DIRECT_NEIGHBOURS)) {
      addEdge(graph, key, n.key, n.nm * DIRECT_PENALTY, null);
    }
  }
}

// ----------------------------------------------------------------------------
// Joins
// ----------------------------------------------------------------------------

/** The graph key of a fix by name near a position, or null when it is not on any airway. */
function graphKeyNear(graph: Graph, id: string, at: LatLon): string | null {
  let best: string | null = null;
  let bestNm = 1;
  for (const key of graph.edges.keys()) {
    if (!key.startsWith(`${id}/`)) continue;
    const nm = greatCircleNm(graph.positions.get(key)!, at);
    if (nm < bestNm) {
      bestNm = nm;
      best = key;
    }
  }
  return best;
}

function connectByRadius(graph: Graph, point: LatLon, node: string, reverse: boolean): void {
  const ranked: { key: string; nm: number }[] = [];
  for (const key of graph.edges.keys()) {
    if (key.startsWith('@')) continue;
    ranked.push({ key, nm: greatCircleNm(point, graph.positions.get(key)!) });
  }
  ranked.sort((x, y) => x.nm - y.nm);
  let candidates = ranked.filter((c) => c.nm <= JOIN_RADIUS_NM);
  if (candidates.length === 0) candidates = ranked.slice(0, JOIN_FALLBACK_COUNT);
  for (const c of candidates) {
    if (reverse) addEdge(graph, c.key, node, c.nm * JOIN_PENALTY, null);
    else addEdge(graph, node, c.key, c.nm * JOIN_PENALTY, null);
  }
}

/**
 * Wires START and END into the network. With candidate procedure joins each one
 * becomes a node reached from START (or reaching END) at the cost of the
 * procedure's own length, and enters the network for free at its fix.
 */
function connectEndpoints(graph: Graph, input: AutoRouteInput): Map<string, RouteJoin> {
  const joinNodes = new Map<string, RouteJoin>();
  graph.positions.set(START, input.from);
  graph.positions.set(END, input.to);
  graph.terminal.delete(START);
  graph.terminal.delete(END);

  const wire = (joins: RouteJoin[] | undefined, point: LatLon, node: string, reverse: boolean) => {
    if (!joins || joins.length === 0) {
      connectByRadius(graph, point, node, reverse);
      return;
    }
    for (const join of joins) {
      const at = { latitude: join.latitude, longitude: join.longitude };
      const jn = `${JOIN_PREFIX}${reverse ? 'in' : 'out'}/${join.id}/${join.procedure}/${join.transition ?? ''}`;
      graph.positions.set(jn, at);
      joinNodes.set(jn, join);
      const legNm = greatCircleNm(point, at);
      if (reverse) addEdge(graph, jn, node, legNm, null);
      else addEdge(graph, node, jn, legNm, null);
      const key = graphKeyNear(graph, join.id, at);
      if (key) {
        graph.terminal.delete(key);
        if (reverse) addEdge(graph, key, jn, 0, null);
        else addEdge(graph, jn, key, 0, null);
      } else {
        connectByRadius(graph, at, jn, reverse);
      }
    }
  };
  wire(input.exits, input.from, START, false);
  wire(input.entries, input.to, END, true);
  return joinNodes;
}

// ----------------------------------------------------------------------------
// Search
// ----------------------------------------------------------------------------

interface SearchResult {
  chain: { key: string; arrivedBy: string | null }[];
  distanceNm: number;
}

function search(graph: Graph, from: LatLon, to: LatLon): SearchResult | null {
  const best = new Map<string, number>([[START, 0]]);
  const cameFrom = new Map<string, { from: string; airway: string | null }>();
  const heap = new MinHeap();
  heap.push(START, greatCircleNm(from, to));
  const closed = new Set<string>();

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (closed.has(current.key)) continue;
    if (current.key === END) break;
    closed.add(current.key);
    const g = best.get(current.key)!;
    const arrivedBy = cameFrom.get(current.key)?.airway ?? null;
    for (const edge of graph.edges.get(current.key) ?? []) {
      if (closed.has(edge.to)) continue;
      const changes = arrivedBy !== null && edge.airway !== null && edge.airway !== arrivedBy;
      const terminal = graph.terminal.has(edge.to) ? TERMINAL_PENALTY : 1;
      const tentative = g + edge.weight * terminal + (changes ? AIRWAY_CHANGE_PENALTY_NM : 0);
      if (tentative >= (best.get(edge.to) ?? Infinity)) continue;
      best.set(edge.to, tentative);
      cameFrom.set(edge.to, { from: current.key, airway: edge.airway });
      heap.push(edge.to, tentative + greatCircleNm(graph.positions.get(edge.to)!, to));
    }
  }
  if (!cameFrom.has(END)) return null;

  const chain: { key: string; arrivedBy: string | null }[] = [];
  let cursor = END;
  while (cursor !== START) {
    const link = cameFrom.get(cursor)!;
    if (cursor !== END) chain.unshift({ key: cursor, arrivedBy: link.airway });
    cursor = link.from;
  }

  let distanceNm = 0;
  let prev: LatLon = from;
  for (const node of chain) {
    const p = graph.positions.get(node.key)!;
    distanceNm += greatCircleNm(prev, p);
    prev = p;
  }
  distanceNm += greatCircleNm(prev, to);
  return { chain, distanceNm };
}

function toResult(found: SearchResult, joinNodes: Map<string, RouteJoin>): AutoRouteResult {
  let sid: ProcedureChoice | undefined;
  let star: ProcedureChoice | undefined;
  const steps: RouteStep[] = [];
  const chain = found.chain;
  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]!;
    const join = joinNodes.get(node.key);
    if (join) {
      const choice = { name: join.procedure, transition: join.transition };
      if (node.key.startsWith(`${JOIN_PREFIX}out/`)) sid = choice;
      else star = choice;
      // The join node shares its position with the fix that follows or precedes it.
      const twin = node.key.startsWith(`${JOIN_PREFIX}out/`) ? chain[i + 1] : chain[i - 1];
      if (twin && twin.key.split('/')[0] === join.id) continue;
      steps.push({ fixId: join.id, airway: chain[i + 1]?.arrivedBy ?? null });
      continue;
    }
    steps.push({ fixId: node.key.split('/')[0]!, airway: chain[i + 1]?.arrivedBy ?? null });
  }
  // A join fix followed by its own graph twin leaves a zero-length "DCT" to itself; drop it.
  const deduped = steps.filter((s, i) => i === 0 || s.fixId !== steps[i - 1]!.fixId);
  return { routeText: compressPath(deduped), distanceNm: found.distanceNm, sid, star };
}

export function autoRoute(input: AutoRouteInput): AutoRouteResult | null {
  const directNm = greatCircleNm(input.from, input.to);
  if (directNm < 1) return null;

  const run = (name: string, opts: BuildOptions) => {
    const started = Date.now();
    const graph = buildGraph(input, opts);
    let result: AutoRouteResult | null = null;
    if (graph && graph.edges.size > 0) {
      const joins = connectEndpoints(graph, input);
      const found = search(graph, input.from, input.to);
      result = found ? toResult(found, joins) : null;
    }
    input.trace?.(
      `${name}: ${result ? `${Math.round(result.distanceNm)} nm, ${result.routeText}` : 'none'} (${Date.now() - started}ms)`
    );
    return result;
  };

  // Airways alone first; direct legs only when that leaves a gap or a long detour.
  const limitNm = directNm * MAX_DETOUR_FACTOR + MAX_DETOUR_SLACK_NM;
  const airways = run('airways', { direct: false });
  if (airways && airways.distanceNm <= limitNm) return airways;
  const withDirect = run('airways and direct legs', { direct: true });
  if (!airways) return withDirect;
  if (!withDirect) return airways;
  return withDirect.distanceNm < airways.distanceNm ? withDirect : airways;
}
