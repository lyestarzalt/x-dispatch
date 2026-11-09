import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { ensureNavLayerOrder } from './navLayerOrder';

/** A map that only knows its layer order. */
function fakeMap(order: string[]) {
  const moves: string[] = [];
  const map = {
    getStyle: () => ({ layers: order.map((id) => ({ id })) }),
    getLayer: (id: string) => (order.includes(id) ? { id } : undefined),
    getLayersOrder: () => [...order],
    moveLayer: (id: string, beforeId?: string) => {
      moves.push(`${id}->${beforeId ?? 'top'}`);
      order.splice(order.indexOf(id), 1);
      order.splice(beforeId ? order.indexOf(beforeId) : order.length, 0, id);
    },
  } as unknown as maplibregl.Map;
  return { map, order, moves };
}

describe('ensureNavLayerOrder', () => {
  it('puts airspace shapes under the airport and the ILS over it', () => {
    const { map, order } = fakeMap([
      'basemap',
      'airport-pavements',
      'airport-runways',
      'nav-ils-course',
      'nav-ils',
      'airport-runway-markings',
      'nav-airspaces-fill',
      'nav-airspaces-outline',
      'nav-airspaces-labels',
      'nav-ils-labels',
    ]);

    ensureNavLayerOrder(map);

    expect(order).toEqual([
      'basemap',
      'nav-airspaces-fill',
      'nav-airspaces-outline',
      'airport-pavements',
      'airport-runways',
      'airport-runway-markings',
      'nav-airspaces-labels',
      'nav-ils-course',
      'nav-ils',
      'nav-ils-labels',
    ]);
  });

  it('keeps the ILS under the traffic overlays', () => {
    const { map, order } = fakeMap(['airport-runways', 'nav-ils-course', 'vatsim-pilots']);
    order.splice(1, 1);
    order.push('nav-ils-course');

    ensureNavLayerOrder(map);

    expect(order).toEqual(['airport-runways', 'nav-ils-course', 'vatsim-pilots']);
  });

  it('moves nothing when the order is already right', () => {
    const { map, moves } = fakeMap([
      'nav-airspaces-fill',
      'airport-runways',
      'nav-ils-course',
      'nav-ils',
      'nav-ils-labels',
      'vatsim-pilots',
    ]);

    ensureNavLayerOrder(map);

    expect(moves).toEqual([]);
  });

  it('leaves airspaces alone when no airport is drawn', () => {
    const { map, moves } = fakeMap(['basemap', 'nav-airspaces-fill', 'nav-ils-course']);
    ensureNavLayerOrder(map);
    expect(moves).toEqual([]);
  });
});
