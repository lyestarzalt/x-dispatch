import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { BaseLayerRenderer } from './BaseLayerRenderer';

function makeMapMock() {
  const order: string[] = [];
  return {
    order,
    getLayer: (id: string) => (order.includes(id) ? { id } : undefined),
    getLayersOrder: () => [...order],
    addLayer: (spec: { id: string }, beforeId?: string) => {
      const at = beforeId ? order.indexOf(beforeId) : -1;
      if (at === -1) order.push(spec.id);
      else order.splice(at, 0, spec.id);
    },
  } as unknown as maplibregl.Map & { order: string[] };
}

class TestRenderer extends BaseLayerRenderer {
  layerId = 'test-layer';
  sourceId = 'test-source';
  hasData(): boolean {
    return true;
  }
  render(): void {}
  add(map: maplibregl.Map, id: string, beforeId?: string): void {
    this.addLayer(map, { id, type: 'fill', source: this.sourceId }, beforeId);
  }
}

describe('BaseLayerRenderer.addLayer', () => {
  it('inserts airport layers under the aircraft and network overlays', () => {
    const map = makeMapMock();
    map.order.push(
      'basemap',
      'flight-trail-live',
      'vatsim-trails',
      'vatsim-pilots',
      'sim-traffic',
      'player-plane'
    );
    const renderer = new TestRenderer();

    renderer.add(map, 'gates');
    renderer.add(map, 'taxiways');

    expect(map.order).toEqual([
      'basemap',
      'gates',
      'taxiways',
      'flight-trail-live',
      'vatsim-trails',
      'vatsim-pilots',
      'sim-traffic',
      'player-plane',
    ]);
  });

  it('appends on top when no overlay layer exists yet', () => {
    const map = makeMapMock();
    map.order.push('basemap');
    new TestRenderer().add(map, 'gates');
    expect(map.order).toEqual(['basemap', 'gates']);
  });

  it('honours an explicit beforeId and never adds a layer twice', () => {
    const map = makeMapMock();
    map.order.push('basemap', 'runways', 'player-plane');
    const renderer = new TestRenderer();
    renderer.add(map, 'markings', 'runways');
    renderer.add(map, 'markings');
    expect(map.order).toEqual(['basemap', 'markings', 'runways', 'player-plane']);
  });
});
