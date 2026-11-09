import {
  calculateBearing,
  destinationPoint,
  haversineDistance,
  nauticalMilesToMeters,
} from '@/lib/utils/geomath';
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

const keyOf = (n: Navaid): string => `${n.associatedAirport}/${n.associatedRunway!.toUpperCase()}`;

/** GS records by airport/runway, so each LOC finds its glide slope in O(1). */
function indexGlideSlopes(navaids: Navaid[]): Map<string, Navaid> {
  const gsByKey = new Map<string, Navaid>();
  for (const n of navaids) {
    if (n.type !== 'GS') continue;
    if (n.bearing === undefined || n.glidepathAngle === undefined) continue;
    if (!n.associatedAirport || !n.associatedRunway) continue;
    gsByKey.set(keyOf(n), n);
  }
  return gsByKey;
}

interface Anchor {
  lat: number;
  lon: number;
  elevationFt: number;
}

/**
 * Where the beam and the course line start: the GS antenna's position
 * projected onto the extended centerline. The LOC antenna sits past the far
 * end of the runway, so anchoring there ran the cone and the line down the
 * whole runway (EPWA read as a thin orange stripe over the pavement). The
 * GS antenna stands beside the touchdown zone, which is where the glide
 * path meets the ground; projecting it onto the centerline removes its
 * ~400 ft lateral offset, the way charts draw it. Without a GS, or with one
 * behind the LOC (bad data), the LOC antenna is used.
 */
function locAnchor(loc: Navaid, course: number, gs: Navaid | undefined): Anchor {
  if (!gs) return { lat: loc.latitude, lon: loc.longitude, elevationFt: loc.elevation };
  const toGsM = haversineDistance(loc.latitude, loc.longitude, gs.latitude, gs.longitude);
  const toGsBearing = calculateBearing(loc.latitude, loc.longitude, gs.latitude, gs.longitude);
  const alongM = toGsM * Math.cos(((toGsBearing - course) * Math.PI) / 180);
  if (!(alongM > 0)) return { lat: loc.latitude, lon: loc.longitude, elevationFt: loc.elevation };
  const [lon, lat] = destinationPoint(loc.latitude, loc.longitude, alongM, course);
  return { lat, lon, elevationFt: gs.elevation };
}

/**
 * Pair every LOC/ILS record with its matching GS record by
 * `associatedAirport + associatedRunway` and anchor the beam at the GS's
 * point on the extended centerline (see `locAnchor`).
 *
 * Returns one spec per LOC that has a paired GS. LOC-only runways (no GS
 * record) produce no spec — the GS wedge is the only 3D primitive this
 * layer renders, so a runway without a GS isn't visualised.
 */
export function pairLocAndGs(navaids: Navaid[]): BeamSpec[] {
  const gsByKey = indexGlideSlopes(navaids);

  const consumedGsKeys = new Set<string>();
  const specs: BeamSpec[] = [];

  for (const loc of navaids) {
    if (loc.type === 'GS') continue;
    if (loc.bearing === undefined) continue;
    if (!loc.associatedAirport || !loc.associatedRunway) continue;
    const key = keyOf(loc);
    const gs = gsByKey.get(key);
    if (!gs) continue;
    if (consumedGsKeys.has(key)) continue; // dedupe: a runway can list multiple LOCs (duplicate region rows)
    consumedGsKeys.add(key);

    const course = (loc.bearing + 180) % 360;
    const anchor = locAnchor(loc, course, gs);
    specs.push({
      id: `${loc.id} ${loc.associatedRunway}`,
      apexLat: anchor.lat,
      apexLon: anchor.lon,
      apexElevationFt: anchor.elevationFt,
      course,
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

/**
 * The 2D extended-centerline for each LOC: from the same anchor as the GS
 * wedge back along the reciprocal of the localizer course, over the same
 * length, so the dashed line and the 3D volume start and end together.
 * Takes LOC and GS records together; GS records only serve as anchors.
 */
export function createILSCourseGeoJSON(navaids: Navaid[]): GeoJSON.FeatureCollection {
  const gsByKey = indexGlideSlopes(navaids);
  const features: GeoJSON.Feature[] = [];
  for (const ils of navaids) {
    if (ils.type === 'GS') continue;
    if (ils.bearing === undefined) continue;
    const course = (ils.bearing + 180) % 360;
    const gs = ils.associatedAirport && ils.associatedRunway ? gsByKey.get(keyOf(ils)) : undefined;
    const anchor = locAnchor(ils, course, gs);
    const origin: [number, number] = [anchor.lon, anchor.lat];
    const endPoint = destinationPoint(
      anchor.lat,
      anchor.lon,
      nauticalMilesToMeters(BEAM_LENGTH_NM),
      course
    );
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [origin, endPoint] },
      properties: { id: ils.id, runway: ils.associatedRunway || '' },
    });
  }
  return { type: 'FeatureCollection', features };
}

// Constants exposed for tests.
export const ILS_BEAM_CONSTANTS = {
  GS_HALF_ANGLE_DEG,
  GS_VERTICAL_HALF_ANGLE_DEG,
  BEAM_LENGTH_NM,
  FAR_EDGE_SEGMENTS,
  FEET_TO_METERS,
} as const;
