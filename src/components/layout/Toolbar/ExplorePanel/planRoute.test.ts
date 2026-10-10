import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { openPlannerForRoute } from './planRoute';

// electron-log's renderer transport waits for the main process, which a node test never has.
vi.mock('@/lib/utils/loggerRenderer', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: new Proxy({}, { get: () => scope }) };
});

const AIRPORTS = [
  { icao: 'LOWI', name: 'Innsbruck', lat: 47.26, lon: 11.34 },
  { icao: 'LSZS', name: 'Samedan', lat: 46.53, lon: 9.88 },
] as Airport[];

beforeEach(() => {
  usePlanBuilderStore.getState().reset();
  usePlanBuilderStore.getState().close();
});

describe('openPlannerForRoute', () => {
  it('fills departure and arrival and opens the plan builder', () => {
    expect(openPlannerForRoute(AIRPORTS, 'LOWI', 'LSZS')).toBe(true);

    const builder = usePlanBuilderStore.getState();
    expect(builder.isOpen).toBe(true);
    expect(builder.departure).toEqual({
      icao: 'LOWI',
      name: 'Innsbruck',
      latitude: 47.26,
      longitude: 11.34,
    });
    expect(builder.arrival?.icao).toBe('LSZS');
  });

  it('leaves the planner alone when either airport is not in X-Plane', () => {
    expect(openPlannerForRoute(AIRPORTS, 'LOWI', 'VQPR')).toBe(false);
    expect(openPlannerForRoute(AIRPORTS, 'VNKT', 'LSZS')).toBe(false);

    const builder = usePlanBuilderStore.getState();
    expect(builder.isOpen).toBe(false);
    expect(builder.departure).toBeNull();
    expect(builder.arrival).toBeNull();
  });

  it('replaces the pair the planner already had', () => {
    usePlanBuilderStore.setState({
      departure: { icao: 'LSZS', name: 'Samedan', latitude: 46.53, longitude: 9.88 },
      routeText: 'XATEL UY30 MTL',
    });

    expect(openPlannerForRoute(AIRPORTS, 'LOWI', 'LSZS')).toBe(true);

    const builder = usePlanBuilderStore.getState();
    expect(builder.departure?.icao).toBe('LOWI');
    expect(builder.arrival?.icao).toBe('LSZS');
    expect(builder.routeText).toBe('');
  });
});
