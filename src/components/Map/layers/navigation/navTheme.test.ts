import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { applyNavLayerTheme } from './navTheme';

function fakeMap(existing: string[]) {
  const calls: Array<[string, string, unknown]> = [];
  const map = {
    getLayer: (id: string) => (existing.includes(id) ? { id } : undefined),
    setPaintProperty: (id: string, prop: string, value: unknown) => {
      calls.push([id, prop, value]);
    },
  } as unknown as maplibregl.Map;
  return { map, calls };
}

describe('applyNavLayerTheme', () => {
  it('re-tints label halos for a light basemap and skips missing layers', () => {
    const { map, calls } = fakeMap(['nav-navaids-labels', 'nav-airspaces-labels']);
    applyNavLayerTheme(map, 'light');
    const touched = calls.map(([id]) => id);
    expect(touched).toContain('nav-navaids-labels');
    expect(touched).toContain('nav-airspaces-labels');
    expect(touched).not.toContain('nav-ils-labels');
    const halo = calls.find(([, prop]) => prop === 'text-halo-color')![2] as string;
    expect(halo.toLowerCase()).not.toBe('#000000');
  });

  it('uses a dark halo on dark and satellite basemaps', () => {
    const { map, calls } = fakeMap(['nav-ils-labels']);
    applyNavLayerTheme(map, 'satellite');
    expect(calls.some(([id, prop]) => id === 'nav-ils-labels' && prop === 'text-halo-color')).toBe(
      true
    );
  });
});
