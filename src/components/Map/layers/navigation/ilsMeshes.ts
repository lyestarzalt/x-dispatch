import { destinationPoint, nauticalMilesToMeters } from '@/lib/utils/geomath';
import type { Navaid } from '@/types/navigation';

// LOC/GS antenna elevation comes from earth_nav.dat in feet.
const FEET_TO_METERS = 0.3048;

// GS beam: horizontal half-width and vertical (slope) half-width.
// The horizontal width is wider than ICAO Annex 10's 2.5° course width on
// purpose — at 18 NM it gives a fan that reads clearly on the map without
// being so narrow it visually vanishes at low pitch.
const GS_HALF_ANGLE_DEG = 2.5;
const GS_VERTICAL_HALF_ANGLE_DEG = 0.7;

const BEAM_LENGTH_NM = 18;

// Far-edge resolution. 12 segments → ~13 verts per ring; cheap and smooth.
const FAR_EDGE_SEGMENTS = 12;

export type BeamKind = 'GS_LOWER' | 'GS_UPPER' | 'GS_LEFT_SIDE' | 'GS_RIGHT_SIDE' | 'GS_FAR_CAP';

type BeamVertex = [number, number, number];

export interface BeamPolygon {
  /** "<LOC-id> <runway>" for cross-referencing in deck.gl debug. */
  id: string;
  /** Closed face ring of [lon, lat, z_meters]. */
  polygon: BeamVertex[];
  kind: BeamKind;
}

/**
 * Per-runway spec — already resolved to apex + slope so the polygon builders
 * don't have to re-do the LOC↔GS pairing.
 */
interface BeamSpec {
  id: string;
  apexLat: number;
  apexLon: number;
  apexElevationFt: number;
  /** Approach-direction bearing (i.e. the LOC course +180°). */
  course: number;
  glidepathAngle: number;
}

/**
 * Older parser builds stored 3.0° as 0.03. Anything below 0.5 is the encoded
 * form — multiply back.
 */
function normalizeGlidepathAngle(angle: number): number {
  return angle < 0.5 ? angle * 100 : angle;
}

/**
 * Pair every LOC/ILS record with its matching GS record by
 * `associatedAirport + associatedRunway`, then anchor BOTH meshes at the LOC
 * antenna position. Physical GS antennas sit ~400 ft beside the runway, so
 * without this re-anchor the GS beam appears visibly off the extended
 * centerline. Charts always draw the GS centered on the runway for the same
 * reason.
 *
 * Returns one spec per LOC that has a paired GS. LOC-only runways (no GS
 * record) produce no spec — the GS wedge is the only 3D primitive this
 * layer renders, so a runway without a GS isn't visualised.
 */
export function pairLocAndGs(navaids: Navaid[]): BeamSpec[] {
  const keyOf = (n: Navaid): string =>
    `${n.associatedAirport}/${n.associatedRunway!.toUpperCase()}`;

  // Index GS records once so the per-LOC lookup is O(1) instead of O(n).
  const gsByKey = new Map<string, Navaid>();
  for (const n of navaids) {
    if (n.type !== 'GS') continue;
    if (n.bearing === undefined || n.glidepathAngle === undefined) continue;
    if (!n.associatedAirport || !n.associatedRunway) continue;
    gsByKey.set(keyOf(n), n);
  }

  const consumedGsKeys = new Set<string>();
  const specs: BeamSpec[] = [];

  // For every LOC with a paired GS, emit ONE spec anchored at the LOC.
  for (const loc of navaids) {
    if (loc.type === 'GS') continue;
    if (loc.bearing === undefined) continue;
    if (!loc.associatedAirport || !loc.associatedRunway) continue;
    const key = keyOf(loc);
    const gs = gsByKey.get(key);
    if (!gs) continue;
    if (consumedGsKeys.has(key)) continue; // dedupe: a runway can list multiple LOCs (duplicate region rows)
    consumedGsKeys.add(key);

    specs.push({
      id: `${loc.id} ${loc.associatedRunway}`,
      apexLat: loc.latitude,
      apexLon: loc.longitude,
      apexElevationFt: loc.elevation,
      course: (loc.bearing + 180) % 360,
      glidepathAngle: normalizeGlidepathAngle(gs.glidepathAngle!),
    });
  }

  // Orphan GS records (no LOC pair in this dataset) — rare, but defensive.
  for (const [key, gs] of gsByKey) {
    if (consumedGsKeys.has(key)) continue;
    specs.push({
      id: `${gs.id} ${gs.associatedRunway}`,
      apexLat: gs.latitude,
      apexLon: gs.longitude,
      apexElevationFt: gs.elevation,
      course: (gs.bearing! + 180) % 360,
      glidepathAngle: normalizeGlidepathAngle(gs.glidepathAngle!),
    });
  }

  return specs;
}

/**
 * Build one far arc of the GS beam (lower or upper bound).
 *
 * The lower wall sits below centerline (slope = glidepath − 0.7°); the upper
 * wall is steeper (slope = glidepath + 0.7°). The sign of `verticalOffsetDeg`
 * picks which.
 */
function buildGsFarEdge(spec: BeamSpec, verticalOffsetDeg: number): BeamVertex[] {
  const baseZ = spec.apexElevationFt * FEET_TO_METERS;
  const farDistanceM = nauticalMilesToMeters(BEAM_LENGTH_NM);
  const slopeDeg = spec.glidepathAngle + verticalOffsetDeg;
  const tanSlope = Math.tan((slopeDeg * Math.PI) / 180);

  const farEdge: BeamVertex[] = [];
  for (let i = 0; i <= FAR_EDGE_SEGMENTS; i++) {
    const t = i / FAR_EDGE_SEGMENTS;
    const bearing = (spec.course - GS_HALF_ANGLE_DEG + t * 2 * GS_HALF_ANGLE_DEG + 360) % 360;
    const [lon, lat] = destinationPoint(spec.apexLat, spec.apexLon, farDistanceM, bearing);
    farEdge.push([lon, lat, baseZ + farDistanceM * tanSlope]);
  }
  return farEdge;
}

function closeRing(vertices: BeamVertex[]): BeamVertex[] {
  return [...vertices, vertices[0]!];
}

function buildGsSlopeFace(apex: BeamVertex, farEdge: BeamVertex[]): BeamVertex[] {
  return closeRing([apex, ...farEdge]);
}

function buildGsWedgeFaces(spec: BeamSpec): BeamPolygon[] {
  const apex: BeamVertex = [spec.apexLon, spec.apexLat, spec.apexElevationFt * FEET_TO_METERS];
  const lowerFarEdge = buildGsFarEdge(spec, -GS_VERTICAL_HALF_ANGLE_DEG);
  const upperFarEdge = buildGsFarEdge(spec, GS_VERTICAL_HALF_ANGLE_DEG);

  const faces: BeamPolygon[] = [
    {
      id: spec.id,
      polygon: buildGsSlopeFace(apex, lowerFarEdge),
      kind: 'GS_LOWER',
    },
    {
      id: spec.id,
      polygon: buildGsSlopeFace(apex, upperFarEdge),
      kind: 'GS_UPPER',
    },
    {
      id: spec.id,
      polygon: [apex, lowerFarEdge[0]!, upperFarEdge[0]!, apex],
      kind: 'GS_LEFT_SIDE',
    },
    {
      id: spec.id,
      polygon: [
        apex,
        upperFarEdge[upperFarEdge.length - 1]!,
        lowerFarEdge[lowerFarEdge.length - 1]!,
        apex,
      ],
      kind: 'GS_RIGHT_SIDE',
    },
  ];

  for (let i = 0; i < FAR_EDGE_SEGMENTS; i++) {
    faces.push({
      id: spec.id,
      polygon: closeRing([
        lowerFarEdge[i]!,
        lowerFarEdge[i + 1]!,
        upperFarEdge[i + 1]!,
        upperFarEdge[i]!,
      ]),
      kind: 'GS_FAR_CAP',
    });
  }

  return faces;
}

export function buildBeamPolygons(navaids: Navaid[]): BeamPolygon[] {
  const out: BeamPolygon[] = [];
  for (const spec of pairLocAndGs(navaids)) {
    out.push(...buildGsWedgeFaces(spec));
  }
  return out;
}

// Constants exposed for tests.
export const ILS_BEAM_CONSTANTS = {
  GS_HALF_ANGLE_DEG,
  GS_VERTICAL_HALF_ANGLE_DEG,
  BEAM_LENGTH_NM,
  FAR_EDGE_SEGMENTS,
  FEET_TO_METERS,
} as const;
