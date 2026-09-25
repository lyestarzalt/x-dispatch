import { describe, expect, it } from 'vitest';
import { type RouteWaypoint, omitFlightPlanWaypoints } from './ProcedureRouteLayer';

const gilon: RouteWaypoint = { fixId: 'GILON', latitude: 43.91, longitude: 5.42 };
const luc: RouteWaypoint = { fixId: 'LUC', latitude: 43.62, longitude: 6.12 };
const unresolved: RouteWaypoint = { fixId: 'NOWHR' };

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
