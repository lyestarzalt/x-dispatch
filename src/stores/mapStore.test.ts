import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/loggerRenderer', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: new Proxy({}, { get: () => scope }) };
});

const { DEFAULT_AIRPORT_FILTERS, migrateMapState } = await import('./mapStore');

describe('migrateMapState', () => {
  it('adds the NAT tracks layer, off, to a v16 blob', () => {
    const result = migrateMapState(
      { navVisibility: { navaids: true, ils: false, airspaces: false, airwaysMode: 'off' } },
      16
    ) as { navVisibility: Record<string, unknown> };
    expect(result.navVisibility).toEqual({
      navaids: true,
      ils: false,
      airspaces: false,
      airwaysMode: 'off',
      natTracks: false,
    });
  });

  it('cascades from v15 through every later step', () => {
    const result = migrateMapState(
      { navVisibility: { navaids: false, ils: false, airspaces: false, airwaysMode: 'off' } },
      15
    ) as { navVisibility: Record<string, unknown>; profileStripPosition: unknown };
    expect(result.profileStripPosition).toBeNull();
    expect(result.navVisibility.natTracks).toBe(false);
  });

  it('adds the procedures-only airport filter, off, to a v17 blob', () => {
    const result = migrateMapState(
      {
        airportFilters: {
          ...DEFAULT_AIRPORT_FILTERS,
          onlyWithProcedures: undefined,
          country: 'France',
        },
      },
      17
    ) as { airportFilters: Record<string, unknown> };
    expect(result.airportFilters.onlyWithProcedures).toBe(false);
    expect(result.airportFilters.country).toBe('France');
  });

  it('cascades from v16 into the v18 step', () => {
    const result = migrateMapState(
      {
        navVisibility: { navaids: true, ils: true, airspaces: true, airwaysMode: 'off' },
        airportFilters: { ...DEFAULT_AIRPORT_FILTERS, onlyWithProcedures: undefined },
      },
      16
    ) as { navVisibility: Record<string, unknown>; airportFilters: Record<string, unknown> };
    expect(result.navVisibility.natTracks).toBe(false);
    expect(result.airportFilters.onlyWithProcedures).toBe(false);
  });
});
