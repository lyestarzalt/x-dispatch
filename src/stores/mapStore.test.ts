import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/loggerRenderer', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: new Proxy({}, { get: () => scope }) };
});

const { migrateMapState } = await import('./mapStore');

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
});
