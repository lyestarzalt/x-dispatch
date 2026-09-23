/**
 * Shortest airway route between two airports. Main process only.
 *
 * The airway table stores fix names, not positions, so the graph is built per
 * request from the fixes inside a box around the great circle. Entry and exit
 * are direct legs to nearby fixes, penalised so the router prefers joining
 * the network early. A* over great-circle distance keeps it well under a
 * second for a continental leg.
 */
import {
  getAllAirwaysFromDb,
  getNavaidsInBounds,
  getWaypointsInBounds,
} from '@/lib/xplaneServices/dataService/navdata/navCache';
import type { AirwaySegment } from '@/types/navigation';
import { type LatLon, greatCircleNm } from './geometry';
import type { AutoRouteResult } from './types';

/** Box padding around the endpoints; wide enough to let the route bend round gaps. */
const MIN_PADDING_NM = 150;
const PADDING_FRACTION = 0.25;
/** Direct legs onto and off the network are allowed this far, and cost more than airway miles. */
const JOIN_RADIUS_NM = 120;
const JOIN_PENALTY = 1.4;
/** Fallback when nothing is inside the join radius: still connect the nearest few fixes. */
const JOIN_FALLBACK_COUNT = 5;
/** Airways of the wrong altitude family cost a little more so a jet stays on the upper network. */
const WRONG_FAMILY_PENALTY = 1.15;
const HIGH_FAMILY_MIN_FT = 18000;
/** Switching airway costs a few miles so the route reads as a handful of long airways. */
const AIRWAY_CHANGE_PENALTY_NM = 12;

/** Only en-route navaids sit on airways; ILS, glideslope and markers are noise here. */
const AIRWAY_NAVAID_TYPES = ['VOR', 'NDB', 'DME', 'VOR-DME', 'VORTAC', 'TACAN'];
/** A continental leg can box in well over the default 5000 fixes. */
const FIX_QUERY_LIMIT = 200000;

const START = '@start';
const END = '@end';

interface Edge {
  to: string;
  weight: number;
  airway: string | null;
}

interface RouteStep {
  fixId: string;
  airway: string | null;
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
 * airway keep only their first and last fix; direct legs list every fix.
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
    if (!isLast && step.airway) out.push(step.airway);
  }
  return out.join(' ');
}

function fixKey(id: string, region: string): string {
  return `${id}/${region}`;
}

export function autoRoute(
  departure: LatLon,
  arrival: LatLon,
  cruiseAltitudeFt: number | null
): AutoRouteResult | null {
  const totalNm = greatCircleNm(departure, arrival);
  if (totalNm < 1) return null;
  const padNm = Math.max(MIN_PADDING_NM, totalNm * PADDING_FRACTION);
  const padLat = padNm / 60;
  const midLat = (departure.latitude + arrival.latitude) / 2;
  const padLon = padNm / (60 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  const minLat = Math.min(departure.latitude, arrival.latitude) - padLat;
  const maxLat = Math.max(departure.latitude, arrival.latitude) + padLat;
  const minLon = Math.min(departure.longitude, arrival.longitude) - padLon;
  const maxLon = Math.max(departure.longitude, arrival.longitude) + padLon;

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

  const preferHigh = (cruiseAltitudeFt ?? HIGH_FAMILY_MIN_FT) >= HIGH_FAMILY_MIN_FT;
  const edges = new Map<string, Edge[]>();
  const addEdge = (from: string, to: string, weight: number, airway: string | null) => {
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from)!.push({ to, weight, airway });
  };

  for (const s of loadSegments()) {
    const a = fixKey(s.fromFix, s.fromRegion);
    const b = fixKey(s.toFix, s.toRegion);
    const pa = positions.get(a);
    const pb = positions.get(b);
    if (!pa || !pb) continue;
    const family = s.isHigh === preferHigh ? 1 : WRONG_FAMILY_PENALTY;
    const weight = greatCircleNm(pa, pb) * family;
    // A segment shared by several airways is stored as "A31-A411": one edge per airway,
    // so the path can stay on whichever name it arrived on.
    for (const name of s.name.split('-')) {
      // direction: 0 both ways, 1 forward only, 2 backward only
      if (s.direction !== 2) addEdge(a, b, weight, name);
      if (s.direction !== 1) addEdge(b, a, weight, name);
    }
  }

  const joinable = [...edges.keys()];
  if (joinable.length === 0) return null;

  const connectEndpoint = (point: LatLon, from: string, reverse: boolean) => {
    const ranked = joinable
      .map((key) => ({ key, nm: greatCircleNm(point, positions.get(key)!) }))
      .sort((x, y) => x.nm - y.nm);
    let candidates = ranked.filter((c) => c.nm <= JOIN_RADIUS_NM);
    if (candidates.length === 0) candidates = ranked.slice(0, JOIN_FALLBACK_COUNT);
    for (const c of candidates) {
      if (reverse) addEdge(c.key, from, c.nm * JOIN_PENALTY, null);
      else addEdge(from, c.key, c.nm * JOIN_PENALTY, null);
    }
  };
  positions.set(START, departure);
  positions.set(END, arrival);
  connectEndpoint(departure, START, false);
  connectEndpoint(arrival, END, true);

  // A* from START to END with great-circle distance to the arrival as the heuristic.
  const best = new Map<string, number>([[START, 0]]);
  const cameFrom = new Map<string, { from: string; airway: string | null }>();
  const heap = new MinHeap();
  heap.push(START, totalNm);
  const closed = new Set<string>();

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (closed.has(current.key)) continue;
    if (current.key === END) break;
    closed.add(current.key);
    const g = best.get(current.key)!;
    const arrivedBy = cameFrom.get(current.key)?.airway ?? null;
    for (const edge of edges.get(current.key) ?? []) {
      if (closed.has(edge.to)) continue;
      const changes = arrivedBy !== null && edge.airway !== null && edge.airway !== arrivedBy;
      const tentative = g + edge.weight + (changes ? AIRWAY_CHANGE_PENALTY_NM : 0);
      if (tentative >= (best.get(edge.to) ?? Infinity)) continue;
      best.set(edge.to, tentative);
      cameFrom.set(edge.to, { from: current.key, airway: edge.airway });
      heap.push(edge.to, tentative + greatCircleNm(positions.get(edge.to)!, arrival));
    }
  }
  if (!cameFrom.has(END)) return null;

  // Walk back from the arrival. `arrivedBy` is the airway used to reach each fix.
  const chain: { key: string; arrivedBy: string | null }[] = [];
  let cursor = END;
  while (cursor !== START) {
    const link = cameFrom.get(cursor)!;
    if (cursor !== END) chain.unshift({ key: cursor, arrivedBy: link.airway });
    cursor = link.from;
  }

  let distanceNm = 0;
  let prev: LatLon = departure;
  for (const node of chain) {
    const p = positions.get(node.key)!;
    distanceNm += greatCircleNm(prev, p);
    prev = p;
  }
  distanceNm += greatCircleNm(prev, arrival);

  // Filing form names the airway a fix is left on, which is the one the next fix is reached by.
  const steps: RouteStep[] = chain.map((node, i) => ({
    fixId: node.key.split('/')[0]!,
    airway: chain[i + 1]?.arrivedBy ?? null,
  }));

  return { routeText: compressPath(steps), distanceNm };
}
