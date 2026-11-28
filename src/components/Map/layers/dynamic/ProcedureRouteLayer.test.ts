import { describe, expect, it, vi } from 'vitest';
import type { ResolvedProcedureWaypoint } from '@/types/navigation';
import {
  addProcedureRouteLayer,
  createLegLabelGeoJSON,
  createRouteGeoJSON,
  createWaypointGeoJSON,
  omitFlightPlanWaypoints,
} from './ProcedureRouteLayer';

const gilon = { fixId: 'GILON', latitude: 43.91, longitude: 5.42 };
const luc = { fixId: 'LUC', latitude: 43.62, longitude: 6.12 };
const unresolved = { fixId: 'NOWHR' };

function wp(over: Partial<ResolvedProcedureWaypoint>): ResolvedProcedureWaypoint {
  return {
    fixId: '',
    fixRegion: '',
    fixType: 'E',
    pathTerminator: 'TF',
    course: null,
    distance: null,
    altitude: null,
    speed: null,
    speedDescriptor: null,
    turnDirection: null,
    recNavaid: null,
    recNavaidRegion: null,
    theta: null,
    rho: null,
    arcRadius: null,
    centerFix: null,
    centerFixRegion: null,
    verticalAngle: null,
    rnp: null,
    holdTimeMin: null,
    isMissedApproach: false,
    resolved: true,
    ...over,
  };
}

describe('omitFlightPlanWaypoints', () => {
  it('returns every waypoint when the flight plan has no fixes', () => {
    expect(omitFlightPlanWaypoints([gilon, luc], [])).toEqual([gilon, luc]);
  });

  it('drops a procedure waypoint the flight plan already draws at the same fix', () => {
    const plan = [{ id: 'GILON', latitude: 43.91, longitude: 5.42 }];
    expect(omitFlightPlanWaypoints([gilon, luc], plan)).toEqual([luc]);
  });

  it('matches fix IDs case-insensitively and tolerates sub-kilometre coordinate drift', () => {
    const plan = [{ id: 'gilon', latitude: 43.912, longitude: 5.418 }];
    expect(omitFlightPlanWaypoints([gilon, luc], plan)).toEqual([luc]);
  });

  it('keeps a same-named fix that sits somewhere else (duplicate identifiers)', () => {
    const plan = [{ id: 'GILON', latitude: 51.5, longitude: -0.1 }];
    expect(omitFlightPlanWaypoints([gilon, luc], plan)).toEqual([gilon, luc]);
  });

  it('keeps unresolved procedure waypoints so they still render in red', () => {
    const plan = [{ id: 'NOWHR', latitude: 43.91, longitude: 5.42 }];
    expect(omitFlightPlanWaypoints([unresolved], plan)).toEqual([unresolved]);
  });
});

// KGJT MONMT3 off runway 11: climb on 116, turn to 240, then direct JNC. Only JNC is a fix, so
// without the runway there is one point and no line; the preview drew nothing.
describe('createRouteGeoJSON for a departure that starts on headings', () => {
  const legs = [
    wp({
      pathTerminator: 'VA',
      course: 116,
      altitude: { descriptor: '+', altitude1: 6600, altitude2: null, isFlightLevel: false },
      resolved: false,
    }),
    wp({ pathTerminator: 'VM', course: 240, turnDirection: 'R', resolved: false }),
    wp({ fixId: 'JNC', pathTerminator: 'DF', latitude: 39.0596, longitude: -108.7926 }),
  ];
  const runway11 = {
    name: '11',
    latitude: 39.1296,
    longitude: -108.5443,
    headingDeg: 127,
    lengthNm: 1.7,
    elevationFt: 4861,
  };

  it('draws the route from the far end of the runway', () => {
    const { features } = createRouteGeoJSON(legs, runway11);
    const line = features[0]?.geometry as GeoJSON.LineString;
    expect(line.coordinates.length).toBeGreaterThan(2);
    // Starts down the runway from the threshold, south-east of it.
    const [lon, lat] = line.coordinates[0] as [number, number];
    expect(lon).toBeGreaterThan(runway11.longitude);
    expect(lat).toBeLessThan(runway11.latitude);
  });

  it('has nothing to draw without the runway', () => {
    expect(createRouteGeoJSON(legs).features).toHaveLength(0);
  });
});

describe('createLegLabelGeoJSON', () => {
  it('places a distance/course label at the midpoint of each leg between two resolved fixes', () => {
    const waypoints = [
      wp({ fixId: 'A', latitude: 40, longitude: -80 }),
      wp({ fixId: 'B', latitude: 40, longitude: -79, course: 90, distance: 12.5 }),
    ];
    const { features } = createLegLabelGeoJSON(waypoints);
    expect(features).toHaveLength(1);
    expect(features[0]?.geometry).toEqual({ type: 'Point', coordinates: [-79.5, 40] });
    expect(features[0]?.properties?.label).toContain('12.5');
  });

  it('skips a leg with neither distance nor course published', () => {
    const waypoints = [
      wp({ fixId: 'A', latitude: 40, longitude: -80 }),
      wp({ fixId: 'B', latitude: 40, longitude: -79 }),
    ];
    expect(createLegLabelGeoJSON(waypoints).features).toHaveLength(0);
  });

  it('skips an unresolved (fixless) waypoint when finding leg endpoints to pair up', () => {
    // A fixless leg in between (e.g. a CD/VD-style course-and-distance leg with no fix of its
    // own) has nothing to anchor a midpoint to, so it's skipped when pairing up resolved fixes -
    // the next resolved fix pairs with the last one seen before it, not with this one.
    const waypoints = [
      wp({ fixId: 'A', latitude: 40, longitude: -80 }),
      wp({ fixId: '', course: 90, distance: 5, resolved: false }),
      wp({ fixId: 'B', latitude: 40, longitude: -79, course: 90, distance: 12.5 }),
    ];
    const { features } = createLegLabelGeoJSON(waypoints);
    expect(features).toHaveLength(1);
  });

  // KMVY VOR RWY 06: the CLAMY hold's course sat on CLAMY and hid its name (GitHub #394).
  it('labels a hold halfway along its inbound leg, clear of the hold fix', () => {
    const clamy = { fixId: 'CLAMY', latitude: 41.2, longitude: -70.6 };
    const waypoints = [
      wp({ ...clamy, isMissedApproach: true }),
      wp({ ...clamy, pathTerminator: 'HM', course: 90, distance: 4, isMissedApproach: true }),
    ];
    const [hold] = createLegLabelGeoJSON(waypoints).features;
    const [lon, lat] = (hold?.geometry as GeoJSON.Point).coordinates as [number, number];
    // Inbound 090 (about 075 true here): the inbound leg lies west of the fix, 2 NM out.
    expect(lon).toBeLessThan(clamy.longitude - 0.02);
    expect(Math.abs(lat - clamy.latitude)).toBeLessThan(0.02);
  });
});

/** A map that keeps its layers in stack order, honouring `beforeId` as MapLibre does. */
function stackMap() {
  const order: string[] = [];
  const sources = new Set<string>();
  return {
    order,
    map: {
      getStyle: () => ({ layers: [] }),
      getSource: (id: string) => (sources.has(id) ? { setData: vi.fn() } : undefined),
      addSource: (id: string) => sources.add(id),
      removeSource: (id: string) => sources.delete(id),
      getLayer: (id: string) => (order.includes(id) ? { id } : undefined),
      addLayer: (spec: { id: string }, beforeId?: string) => {
        const at = beforeId ? order.indexOf(beforeId) : -1;
        if (at === -1) order.push(spec.id);
        else order.splice(at, 0, spec.id);
      },
      removeLayer: (id: string) => order.splice(order.indexOf(id), 1),
      moveLayer: (id: string) => {
        order.splice(order.indexOf(id), 1);
        order.push(id);
      },
    },
  };
}

describe('addProcedureRouteLayer', () => {
  it('colors helicopter labels with their route', () => {
    const { map } = stackMap();
    const added = vi.spyOn(map, 'addLayer');
    addProcedureRouteLayer(map as never, {
      type: 'SID',
      name: 'COPTER',
      waypoints: [wp(gilon), wp(luc)],
    });
    const layers = added.mock.calls.map(
      ([layer]) => layer as unknown as { type: string; paint: Record<string, unknown> }
    );
    const line = layers.find((layer) => layer.type === 'line')!.paint['line-color'];
    for (const layer of layers.filter((layer) => layer.type === 'symbol'))
      expect(layer.paint['text-color']).toBe(line);
  });

  // MapLibre places the top symbol layer first, so the top one wins a collision. A course label
  // on top hid the hold fix's name (GitHub #394); fix names must sit above the course labels.
  it('stacks fix names above the leg course labels', () => {
    const { map, order } = stackMap();
    addProcedureRouteLayer(map as never, {
      type: 'APPROACH',
      name: 'S06',
      waypoints: [
        wp({ ...gilon, pathTerminator: 'IF' }),
        wp({ ...luc, course: 120, distance: 34 }),
      ],
    });
    expect(order.indexOf('procedure-waypoint-labels')).toBeGreaterThan(
      order.indexOf('procedure-leg-labels')
    );
  });

  // The preview leaves a fix the plan already labels to the plan's label, which sat under the
  // preview's course labels and lost to them: CLAMY and RW06 vanished (GitHub #394).
  it('raises the plan fix labels above the preview when the plan labels some of its fixes', () => {
    const { map, order } = stackMap();
    map.addLayer({ id: 'flightplan-labels' });
    map.addLayer({ id: 'flightplan-altitude-labels' });
    addProcedureRouteLayer(
      map as never,
      {
        type: 'APPROACH',
        name: 'S06',
        waypoints: [
          wp({ ...gilon, pathTerminator: 'IF' }),
          wp({ ...luc, course: 120, distance: 34 }),
        ],
      },
      undefined,
      { planFixes: [{ id: 'LUC', latitude: luc.latitude, longitude: luc.longitude }] }
    );
    expect(order.slice(-2)).toEqual(['flightplan-labels', 'flightplan-altitude-labels']);
  });
});

// A right-click on a fix reads its position from these properties: the rendered
// geometry is rounded to the tile grid and an INS rejects the result.
describe('createWaypointGeoJSON', () => {
  it('carries each fix position as properties for exact snapping', () => {
    const fc = createWaypointGeoJSON([wp({ ...gilon, pathTerminator: 'IF' }), wp(luc)]);
    expect(fc.features.map((f) => [f.properties?.latitude, f.properties?.longitude])).toEqual([
      [43.91, 5.42],
      [43.62, 6.12],
    ]);
  });
});
