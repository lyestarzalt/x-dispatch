import { describe, expect, it } from 'vitest';
import type { Navaid } from '@/types/navigation';
import {
  ILS_BEAM_CONSTANTS,
  buildBeamPolygons,
  createILSCourseGeoJSON,
  pairLocAndGs,
} from './ilsMeshes';

function makeNavaid(overrides: Partial<Navaid>): Navaid {
  return {
    type: 'ILS',
    id: 'ITEST',
    name: 'TEST',
    elevation: 0,
    frequency: 11050,
    range: 18,
    magneticVariation: 0,
    region: 'XX',
    country: 'XX',
    latitude: 0,
    longitude: 0,
    bearing: 0,
    associatedAirport: 'KTST',
    associatedRunway: '01',
    ...overrides,
  };
}

describe('pairLocAndGs', () => {
  it('anchors a paired GS on the extended centerline abeam the GS antenna', () => {
    // LOC at the origin, course 090 flown: the runway runs west of the antenna.
    // The GS antenna stands 2.2 km west and 110 m north (beside the runway).
    const navaids: Navaid[] = [
      makeNavaid({
        type: 'ILS',
        id: 'ILOC',
        latitude: 0,
        longitude: 0,
        bearing: 90,
        elevation: 50,
      }),
      makeNavaid({
        type: 'GS',
        id: 'IGS',
        latitude: 0.001,
        longitude: -0.02,
        bearing: 90,
        glidepathAngle: 3,
        elevation: 40,
      }),
    ];

    const specs = pairLocAndGs(navaids);
    expect(specs).toHaveLength(1);
    // On the centerline (lateral offset removed), level with the GS antenna along the runway.
    expect(specs[0]!.apexLat).toBeCloseTo(0, 4);
    expect(specs[0]!.apexLon).toBeCloseTo(-0.02, 4);
    expect(specs[0]!.apexElevationFt).toBe(40);
    expect(specs[0]!.course).toBe(270);
    expect(specs[0]!.glidepathAngle).toBe(3);
  });

  it('falls back to the LOC antenna when the GS lies behind it', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC', latitude: 0, longitude: 0, bearing: 90 }),
      makeNavaid({
        type: 'GS',
        id: 'IGS',
        latitude: 0,
        longitude: 0.02,
        bearing: 90,
        glidepathAngle: 3,
      }),
    ];
    const specs = pairLocAndGs(navaids);
    expect(specs[0]!.apexLat).toBe(0);
    expect(specs[0]!.apexLon).toBe(0);
  });

  it('emits nothing for a LOC with no paired GS', () => {
    const navaids: Navaid[] = [makeNavaid({ type: 'ILS', id: 'ILOC' })];
    expect(pairLocAndGs(navaids)).toEqual([]);
  });

  it('falls back to the GS antenna position when no LOC pair exists', () => {
    const navaids: Navaid[] = [
      makeNavaid({
        type: 'GS',
        id: 'IGS',
        latitude: 11,
        longitude: 21,
        bearing: 50,
        glidepathAngle: 3,
      }),
    ];
    const specs = pairLocAndGs(navaids);
    expect(specs).toHaveLength(1);
    expect(specs[0]!.apexLat).toBe(11);
    expect(specs[0]!.glidepathAngle).toBe(3);
  });

  it('normalises the legacy ÷100 glidepath quirk', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC' }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 0.03 }),
    ];
    const specs = pairLocAndGs(navaids);
    expect(specs[0]!.glidepathAngle).toBeCloseTo(3, 6);
  });

  it('skips navaids missing bearing or association fields', () => {
    const navaids: Navaid[] = [
      makeNavaid({ id: 'NOBEAR', bearing: undefined }),
      makeNavaid({ id: 'NOAIRPORT', associatedAirport: undefined }),
      makeNavaid({ id: 'NORWAY', associatedRunway: undefined }),
    ];
    expect(pairLocAndGs(navaids)).toEqual([]);
  });
});

describe('buildBeamPolygons', () => {
  it('emits a closed GS wedge volume per paired runway, and nothing for LOC', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC' }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 3 }),
    ];
    const beams = buildBeamPolygons(navaids);
    const kindCounts = beams.reduce<Record<string, number>>((counts, beam) => {
      counts[beam.kind] = (counts[beam.kind] ?? 0) + 1;
      return counts;
    }, {});

    expect(kindCounts).toEqual({
      GS_LOWER: 1,
      GS_UPPER: 1,
      GS_LEFT_SIDE: 1,
      GS_RIGHT_SIDE: 1,
      GS_FAR_CAP: ILS_BEAM_CONSTANTS.FAR_EDGE_SEGMENTS,
    });
  });

  it('emits nothing for a LOC-only airport (no GS to wedge)', () => {
    const navaids: Navaid[] = [makeNavaid({ type: 'ILS', id: 'ILOC' })];
    expect(buildBeamPolygons(navaids)).toEqual([]);
  });

  it('GS_UPPER far edge climbs higher than GS_LOWER (wedge thickness)', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC' }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 3 }),
    ];
    const beams = buildBeamPolygons(navaids);
    const lower = beams.find((b) => b.kind === 'GS_LOWER')!;
    const upper = beams.find((b) => b.kind === 'GS_UPPER')!;
    // index 1 is the first far-edge vertex (after the apex)
    expect(upper.polygon[1]![2]).toBeGreaterThan(lower.polygon[1]![2]);
  });

  it('side faces bridge the lower and upper far-edge corners', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC' }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 3 }),
    ];
    const beams = buildBeamPolygons(navaids);
    const lower = beams.find((b) => b.kind === 'GS_LOWER')!;
    const upper = beams.find((b) => b.kind === 'GS_UPPER')!;
    const left = beams.find((b) => b.kind === 'GS_LEFT_SIDE')!;
    const right = beams.find((b) => b.kind === 'GS_RIGHT_SIDE')!;

    expect(left.polygon).toEqual([
      lower.polygon[0],
      lower.polygon[1],
      upper.polygon[1],
      lower.polygon[0],
    ]);
    expect(right.polygon).toEqual([
      lower.polygon[0],
      upper.polygon[upper.polygon.length - 2],
      lower.polygon[lower.polygon.length - 2],
      lower.polygon[0],
    ]);
  });

  it('far cap is segmented into quads that connect lower and upper far arcs', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC' }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 3 }),
    ];
    const farCaps = buildBeamPolygons(navaids).filter((b) => b.kind === 'GS_FAR_CAP');

    expect(farCaps).toHaveLength(ILS_BEAM_CONSTANTS.FAR_EDGE_SEGMENTS);
    for (const cap of farCaps) {
      expect(cap.polygon).toHaveLength(5);
      expect(cap.polygon[0]).toEqual(cap.polygon[4]);
      expect(cap.polygon[2]![2]).toBeGreaterThan(cap.polygon[0]![2]);
      expect(cap.polygon[3]![2]).toBeGreaterThan(cap.polygon[1]![2]);
    }
  });

  it('GS_UPPER far edge rises by length * tan(glidepath + 0.7°) above the apex', () => {
    const lengthM = 1852 * ILS_BEAM_CONSTANTS.BEAM_LENGTH_NM;
    const upperSlope = 3 + ILS_BEAM_CONSTANTS.GS_VERTICAL_HALF_ANGLE_DEG;
    const expectedTopZ = lengthM * Math.tan((upperSlope * Math.PI) / 180);

    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC' }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 3 }),
    ];
    const upper = buildBeamPolygons(navaids).find((b) => b.kind === 'GS_UPPER')!;
    expect(upper.polygon[1]![2]).toBeCloseTo(expectedTopZ, 0);
  });

  it('apex Z = GS antenna elevation (in metres)', () => {
    const elevFt = 1500;
    const expectedApexZ = elevFt * ILS_BEAM_CONSTANTS.FEET_TO_METERS;
    // GS ahead of the LOC along the course (bearing 0 → course 180, so south of it).
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC', elevation: 1400 }),
      makeNavaid({ type: 'GS', id: 'IGS', glidepathAngle: 3, elevation: elevFt, latitude: -0.02 }),
    ];
    const upper = buildBeamPolygons(navaids).find((b) => b.kind === 'GS_UPPER')!;
    expect(upper.polygon[0]![2]).toBeCloseTo(expectedApexZ, 6);
  });

  it('pairs across multiple runways at the same airport without crosstalk', () => {
    const navaids: Navaid[] = [
      makeNavaid({ type: 'ILS', id: 'ILOC09', associatedRunway: '09', bearing: 90 }),
      makeNavaid({ type: 'ILS', id: 'ILOC27', associatedRunway: '27', bearing: 270 }),
      makeNavaid({
        type: 'GS',
        id: 'IGS09',
        associatedRunway: '09',
        bearing: 90,
        glidepathAngle: 3,
      }),
      makeNavaid({
        type: 'GS',
        id: 'IGS27',
        associatedRunway: '27',
        bearing: 270,
        glidepathAngle: 5.5,
      }),
    ];
    const specs = pairLocAndGs(navaids);
    expect(specs).toHaveLength(2);
    expect(specs.find((s) => s.id.startsWith('ILOC09'))!.glidepathAngle).toBeCloseTo(3, 6);
    expect(specs.find((s) => s.id.startsWith('ILOC27'))!.glidepathAngle).toBeCloseTo(5.5, 6);
  });
});

describe('createILSCourseGeoJSON', () => {
  const loc: Navaid = {
    id: 'IMCG',
    name: 'MCGRATH ILS',
    type: 'ILS',
    latitude: 62.946,
    longitude: -155.607,
    elevation: 300,
    frequency: 10950,
    bearing: 163,
    associatedAirport: 'PAMC',
    associatedRunway: '16',
  } as Navaid;

  it('draws the extended centerline over the full beam length, on the reciprocal course', () => {
    const fc = createILSCourseGeoJSON([loc]);
    const line = fc.features[0]!.geometry as GeoJSON.LineString;
    const [start, end] = [line.coordinates[0]!, line.coordinates.at(-1)!];
    expect(start).toEqual([loc.longitude, loc.latitude]);
    const distNm = Math.hypot(
      (end[1]! - loc.latitude) * 60,
      (end[0]! - loc.longitude) * 60 * Math.cos((loc.latitude * Math.PI) / 180)
    );
    expect(distNm).toBeCloseTo(ILS_BEAM_CONSTANTS.BEAM_LENGTH_NM, 0);
    // course 163 → line heads 343 (north-west-ish): end lies north and west
    expect(end[1]!).toBeGreaterThan(loc.latitude);
    expect(end[0]!).toBeLessThan(loc.longitude);
  });

  it('starts at the GS anchor when the runway has one, matching the wedge apex', () => {
    const gs: Navaid = {
      ...loc,
      id: 'IMCG',
      type: 'GS',
      latitude: 62.96,
      longitude: -155.62,
      glidepathAngle: 3,
    };
    const fc = createILSCourseGeoJSON([loc, gs]);
    expect(fc.features).toHaveLength(1);
    const start = (fc.features[0]!.geometry as GeoJSON.LineString).coordinates[0]!;
    const spec = pairLocAndGs([loc, gs])[0]!;
    expect(start[0]).toBeCloseTo(spec.apexLon, 9);
    expect(start[1]).toBeCloseTo(spec.apexLat, 9);
    expect(start).not.toEqual([loc.longitude, loc.latitude]);
  });
});
