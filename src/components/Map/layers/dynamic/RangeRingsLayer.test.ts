import { describe, expect, it, vi } from 'vitest';
import type { RangeRingCategory } from '@/types/layers';
import { addRangeRingsLayer, removeRangeRingsLayer } from './RangeRingsLayer';

function makeMapMock() {
  const layers = new Set<string>();
  const sources = new Set<string>();
  return {
    layers,
    sources,
    getStyle: () => ({ layers: [], sources: {} }),
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getSource: (id: string) => (sources.has(id) ? ({ setData: vi.fn() } as object) : undefined),
    addLayer: (spec: { id: string }) => layers.add(spec.id),
    addSource: (id: string) => sources.add(id),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    on: vi.fn(),
    off: vi.fn(),
    dragPan: { enable: vi.fn(), disable: vi.fn() } as
      | { enable: () => void; disable: () => void }
      | undefined,
    getCanvas: () => ({ style: { cursor: '' } }) as { style: { cursor: string } },
  };
}

const CONFIG = {
  centerLat: 40,
  centerLon: -74,
  durationHours: 1,
  categories: [
    {
      id: 'turboprop' as RangeRingCategory,
      color: '#ff0000',
      speed: 250,
      label: 'Turboprop',
    },
  ],
};

describe('RangeRingsLayer teardown', () => {
  it('does not throw when the previously-bound map has been destroyed', () => {
    const map1 = makeMapMock();
    addRangeRingsLayer(map1 as unknown as import('maplibre-gl').Map, CONFIG, () => {});

    // Simulate map1.remove() — MapLibre nulls dragPan on destroy.
    map1.dragPan = undefined;

    // A second map mounts and useRangeRingsSync runs addRangeRingsLayer again.
    // Internally that calls teardownRingDrag(), which still holds map1 in its
    // module-level singleton. Pre-fix this threw "Cannot read properties of
    // undefined (reading 'enable')".
    const map2 = makeMapMock();
    expect(() =>
      addRangeRingsLayer(map2 as unknown as import('maplibre-gl').Map, CONFIG, () => {})
    ).not.toThrow();

    // Cleanup for module-level dragState.
    removeRangeRingsLayer(map2 as unknown as import('maplibre-gl').Map);
  });

  it('cleans up listeners on a live map', () => {
    const map = makeMapMock();
    addRangeRingsLayer(map as unknown as import('maplibre-gl').Map, CONFIG, () => {});
    removeRangeRingsLayer(map as unknown as import('maplibre-gl').Map);
    // dragPan was re-enabled on the live map.
    expect(map.dragPan!.enable).toHaveBeenCalled();
  });
});
