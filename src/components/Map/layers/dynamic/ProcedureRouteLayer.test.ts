import { describe, expect, it } from 'vitest';
import type { ResolvedProcedureWaypoint } from '@/types/navigation';
import { createLegLabelGeoJSON, omitFlightPlanWaypoints } from './ProcedureRouteLayer';

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
});
