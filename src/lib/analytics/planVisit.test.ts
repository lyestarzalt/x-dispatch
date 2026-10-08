import { describe, expect, it } from 'vitest';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import { sanitizeEvent } from './events';
import { type PlanVisit, planVisitSummary } from './planVisit';

const endpoint = (icao: string, extra: Partial<PlanEndpoint> = {}): PlanEndpoint => ({
  icao,
  latitude: 0,
  longitude: 0,
  ...extra,
});

const visit = (extra: Partial<PlanVisit> = {}): PlanVisit => ({
  openedAt: 0,
  route: null,
  randomArrival: null,
  saved: false,
  startSet: false,
  ...extra,
});

const plan = (extra: Partial<Parameters<typeof planVisitSummary>[0]> = {}) => ({
  departure: endpoint('EGLL'),
  arrival: endpoint('LFPG'),
  routeText: '',
  alternate: null,
  ...extra,
});

describe('planVisitSummary', () => {
  it('reports an empty visit without airports as no route', () => {
    const summary = planVisitSummary(
      plan({ departure: null, arrival: null }),
      visit(),
      'jet',
      5_000
    );
    expect(summary).toMatchObject({
      has_departure: false,
      has_arrival: false,
      route: 'none',
      procedures: 0,
      time_open: 'under_10s',
    });
  });

  it('reports a pair with no route text as direct', () => {
    expect(planVisitSummary(plan(), visit(), 'jet', 0).route).toBe('direct');
  });

  it('keeps how the route was built, typed by default', () => {
    const routed = plan({ routeText: 'DVR UL9 KONAN' });
    expect(planVisitSummary(routed, visit({ route: 'auto' }), 'jet', 0).route).toBe('auto');
    expect(planVisitSummary(routed, visit({ route: 'restored' }), 'jet', 0).route).toBe('restored');
    expect(planVisitSummary(routed, visit(), 'jet', 0).route).toBe('typed');
  });

  it('reports a route through a North Atlantic track as track', () => {
    const routed = plan({ routeText: 'DOGAL NATA 50N050W' });
    expect(planVisitSummary(routed, visit({ route: 'auto' }), 'jet', 0).route).toBe('track');
  });

  it('counts the chosen procedures and the alternate', () => {
    const summary = planVisitSummary(
      plan({
        departure: endpoint('EGLL', { sid: { name: 'DVR6J', transition: null } }),
        arrival: endpoint('LFPG', {
          star: { name: 'MOPA5W', transition: null },
          approach: { name: 'I27R', transition: null },
        }),
        alternate: endpoint('LFPO'),
      }),
      visit(),
      'turboprop',
      0
    );
    expect(summary).toMatchObject({ procedures: 3, alternate: true, aircraft_class: 'turboprop' });
  });

  it('credits the random panel only while its pick is still the arrival', () => {
    expect(
      planVisitSummary(plan(), visit({ randomArrival: 'LFPG' }), 'jet', 0).arrival_from_random
    ).toBe(true);
    expect(
      planVisitSummary(plan(), visit({ randomArrival: 'EDDF' }), 'jet', 0).arrival_from_random
    ).toBe(false);
  });

  it('passes the allowlist', () => {
    const summary = planVisitSummary(
      plan(),
      visit({ saved: true, startSet: true }),
      'prop',
      120_000
    );
    expect(sanitizeEvent('flight_plan_closed', summary)?.properties).toEqual(summary);
  });
});
