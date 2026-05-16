import { describe, expect, it, vi } from 'vitest';
import type { LoadingProgress } from '@/types/xplane';
import { loadRequiredStartupData } from './startupLoader';
import type { AirportProgressCallback, DataLoadStatus } from './types';

function makeStatus(counts: {
  navaids?: number;
  waypoints?: number;
  airspaces?: number;
  airways?: number;
}): DataLoadStatus {
  return {
    xplanePath: '/x-plane',
    pathValid: true,
    airports: {
      loaded: true,
      count: 0,
      source: null,
      breakdown: { globalAirports: 0, customScenery: 0, customSceneryPacks: 0 },
    },
    navaids: {
      loaded: true,
      count: counts.navaids ?? 0,
      byType: {},
      source: null,
    },
    waypoints: { loaded: true, count: counts.waypoints ?? 0, source: null },
    airspaces: { loaded: true, count: counts.airspaces ?? 0, source: null },
    airways: { loaded: true, count: counts.airways ?? 0, source: null },
    atc: null,
    holds: null,
    aptMeta: null,
    sources: null,
  };
}

describe('loadRequiredStartupData', () => {
  it('starts all required dataset loads without waiting for airports to finish', async () => {
    const events: LoadingProgress[] = [];
    const starts: string[] = [];
    let resolveAirports!: () => void;

    const manager = {
      rebuildAirportCache: vi.fn(async () => {
        starts.push('airports');
        await new Promise<void>((resolve) => {
          resolveAirports = resolve;
        });
      }),
      loadNavaidsOnly: vi.fn(async () => {
        starts.push('navaids');
      }),
      loadWaypointsOnly: vi.fn(async () => {
        starts.push('waypoints');
      }),
      loadAirspacesOnly: vi.fn(async () => {
        starts.push('airspaces');
      }),
      loadAirwaysOnly: vi.fn(async () => {
        starts.push('airways');
      }),
      getStatus: vi.fn(() =>
        makeStatus({
          navaids: 11,
          waypoints: 22,
          airspaces: 33,
          airways: 44,
        })
      ),
    };

    const loading = loadRequiredStartupData(manager, '/x-plane', (event) => events.push(event));
    await Promise.resolve();

    expect(starts).toEqual(['airports', 'navaids', 'waypoints', 'airspaces', 'airways']);

    resolveAirports();
    await loading;

    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'navaids',
        status: 'loading',
        messageKey: 'loading.messages.navaids',
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'airways',
        status: 'complete',
        messageKey: 'loading.messages.airwaysDone',
        count: 44,
      })
    );
  });

  it('emits localized airport progress keys from airport cache events', async () => {
    const events: LoadingProgress[] = [];
    const manager = {
      rebuildAirportCache: vi.fn(async (_path: string, onProgress?: AirportProgressCallback) => {
        onProgress?.({ phase: 'cache-stale', reason: 'first-launch' });
        onProgress?.({ phase: 'global', parsed: 500, estimated: 1000 });
        onProgress?.({
          phase: 'custom',
          packIndex: 1,
          packCount: 3,
          packName: 'Custom Pack',
        });
        onProgress?.({ phase: 'done', count: 1234, fromCache: false });
      }),
      loadNavaidsOnly: vi.fn(async () => {}),
      loadWaypointsOnly: vi.fn(async () => {}),
      loadAirspacesOnly: vi.fn(async () => {}),
      loadAirwaysOnly: vi.fn(async () => {}),
      getStatus: vi.fn(() => makeStatus({})),
    };

    await loadRequiredStartupData(manager, '/x-plane', (event) => events.push(event));

    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.firstLaunch',
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.globalAirports',
        detail: expect.objectContaining({
          current: 500,
          total: 1000,
          labelKey: 'loading.details.globalAirports',
        }),
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.customScenery',
        messageParams: { current: 2, total: 3 },
        detail: expect.objectContaining({ label: 'Custom Pack' }),
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'airports',
        status: 'complete',
        messageKey: 'loading.messages.airportsDone',
        count: 1234,
      })
    );
  });
});
