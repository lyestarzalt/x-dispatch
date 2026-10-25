import { describe, expect, it, vi } from 'vitest';
import type { PlanePosition } from '@/types/xplane';
import { addPlaneLayer, createGeoJSON, removePlaneLayer, updatePlaneLayer } from './PlaneLayer';
import {
  airplaneOutline,
  createOwnshipIcon,
  ownshipIconId,
  ownshipShadowId,
  ownshipShapeIconId,
  ownshipShapeShadowId,
} from './ownshipIcon';

vi.mock('@/lib/map/labelFonts', () => ({ labelFont: () => ['Noto Sans Regular'] }));

type MlMap = import('maplibre-gl').Map;

function makeMapMock() {
  const layers = new Map<
    string,
    { id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }
  >();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const images = new Set<string>();
  return {
    layers,
    sources,
    images,
    getStyle: () => ({ layers: [], sources: {} }),
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addLayer: (spec: {
      id: string;
      layout?: Record<string, unknown>;
      paint?: Record<string, unknown>;
    }) => layers.set(spec.id, spec),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string) => images.add(id)),
    removeImage: (id: string) => images.delete(id),
    moveLayer: vi.fn(),
  };
}

/** The icon-size a fresh layer gets for a style. */
function makeStyled(size: 'small' | 'medium' | 'large', color: 'magenta'): number {
  const map = makeMapMock();
  addPlaneLayer(map as unknown as MlMap, position(), { size, color, altitudeCues: true });
  return map.layers.get('player-plane')?.layout?.['icon-size'] as number;
}

function position(over: Partial<PlanePosition> = {}): PlanePosition {
  return {
    lat: 47.4,
    lng: 8.5,
    altitude: 3500,
    altitudeAGL: 2000,
    heading: 90,
    groundspeed: 110,
    aircraftCategory: 'ga',
    icaoType: 'C172',
    tailNumber: 'HB-ABC',
    wingspanM: 11,
    verticalSpeed: 0,
    ...over,
  };
}

describe('ownship icon geometry', () => {
  it('is a closed, left-right symmetric polygon with the nose on top', () => {
    const pts = airplaneOutline();
    expect(pts[0]).toEqual([0.5, 0.03]);
    const xs = pts.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(1 - Math.max(...xs), 5);
    // Every point on the right has its mirror on the left.
    for (const [x, y] of pts) {
      expect(pts.some(([mx, my]) => Math.abs(mx - (1 - x)) < 1e-9 && my === y)).toBe(true);
    }
  });

  it('renders a transparent fallback outside the browser', () => {
    const icon = createOwnshipIcon('airplane');
    expect(icon.width).toBe(128);
    expect(icon.pixelRatio).toBe(2);
    expect(icon.data.length).toBe(128 * 128 * 4);
  });
});

describe('PlaneLayer', () => {
  it('adds shadow, symbol and label layers with the airplane icon', () => {
    const map = makeMapMock();
    addPlaneLayer(map as unknown as MlMap, position());

    expect([...map.layers.keys()]).toEqual([
      'player-plane-shadow',
      'player-plane',
      'player-plane-label',
    ]);
    const airplane = ownshipIconId('airplane', 'magenta');
    expect(map.addImage).toHaveBeenCalledWith(
      airplane,
      expect.objectContaining({ pixelRatio: 2 }),
      { pixelRatio: 2 }
    );
    // The type's silhouette first, the generic silhouette next, the drawn placeholder last.
    expect(map.layers.get('player-plane')?.layout?.['icon-image']).toEqual([
      'coalesce',
      ['image', ownshipShapeIconId('C172', 'magenta')],
      ['image', ownshipShapeIconId('Unidentified', 'magenta')],
      ['image', airplane],
    ]);
    expect(map.layers.get('player-plane-shadow')?.layout?.['icon-image']).toEqual([
      'coalesce',
      ['image', ownshipShapeShadowId('C172')],
      ['image', ownshipShapeShadowId('Unidentified')],
      ['image', ownshipShadowId('airplane')],
    ]);
  });

  it('draws a helicopter from its own silhouette, else the drawn body, never the airplane shape', () => {
    const map = makeMapMock();
    addPlaneLayer(
      map as unknown as MlMap,
      position({ aircraftCategory: 'helicopter', icaoType: 'EC35' })
    );
    expect(map.layers.get('player-plane')?.layout?.['icon-image']).toEqual([
      'coalesce',
      ['image', ownshipShapeIconId('EC35', 'magenta')],
      ['image', ownshipIconId('helicopter', 'magenta')],
    ]);
  });

  it('rebuilds the symbol chain when the aircraft type changes', () => {
    const map = makeMapMock();
    addPlaneLayer(map as unknown as MlMap, position({ icaoType: 'C172' }));
    updatePlaneLayer(map as unknown as MlMap, position({ icaoType: 'H/B744' }));
    expect(map.layers.get('player-plane')?.layout?.['icon-image']).toEqual([
      'coalesce',
      ['image', ownshipShapeIconId('B744', 'magenta')],
      ['image', ownshipShapeIconId('Unidentified', 'magenta')],
      ['image', ownshipIconId('airplane', 'magenta')],
    ]);
  });

  it('keeps the same on-screen size regardless of wingspan and zoom', () => {
    const small = makeMapMock();
    addPlaneLayer(small as unknown as MlMap, position({ wingspanM: 11 }));
    const heavy = makeMapMock();
    addPlaneLayer(heavy as unknown as MlMap, position({ wingspanM: 80 }));
    const size = small.layers.get('player-plane')?.layout?.['icon-size'];
    expect(size).toEqual(heavy.layers.get('player-plane')?.layout?.['icon-size']);
    // A plain number: no zoom expression, so the symbol never grows or shrinks with the map.
    expect(typeof size).toBe('number');
  });

  it('sizes and colours the symbol from the pilot style, and rebuilds when it changes', () => {
    const map = makeMapMock();
    addPlaneLayer(map as unknown as MlMap, position(), {
      size: 'large',
      color: 'magenta',
      altitudeCues: true,
    });
    const yellow = ownshipIconId('airplane', 'magenta');
    expect(map.layers.get('player-plane')?.layout?.['icon-image']).toContainEqual([
      'image',
      yellow,
    ]);
    expect(map.layers.get('player-plane')?.layout?.['icon-size']).toBeGreaterThan(
      makeStyled('medium', 'magenta')
    );
    expect(map.layers.get('player-plane-label')?.paint?.['text-color']).toBe('#E040FB');

    updatePlaneLayer(map as unknown as MlMap, position(), {
      size: 'small',
      color: 'magenta',
      altitudeCues: true,
    });
    expect(map.addImage).toHaveBeenCalledTimes(2);
    expect(map.layers.get('player-plane')?.layout?.['icon-size']).toBeLessThan(
      makeStyled('medium', 'magenta')
    );

    updatePlaneLayer(map as unknown as MlMap, position(), {
      size: 'small',
      color: 'red',
      altitudeCues: true,
    });
    expect(map.addImage).toHaveBeenCalledTimes(3);
    expect(map.layers.get('player-plane')?.layout?.['icon-image']).toContainEqual([
      'image',
      ownshipIconId('airplane', 'red'),
    ]);
  });

  it('only pushes data on a position update, and rebuilds when the category changes', () => {
    const map = makeMapMock();
    addPlaneLayer(map as unknown as MlMap, position());
    const source = map.sources.get('player-plane-source')!;

    updatePlaneLayer(map as unknown as MlMap, position({ heading: 180 }));
    expect(source.setData).toHaveBeenCalledTimes(1);
    expect(map.addImage).toHaveBeenCalledTimes(2);

    updatePlaneLayer(map as unknown as MlMap, position({ aircraftCategory: 'helicopter' }));
    expect(map.addImage).toHaveBeenCalledTimes(4);
    const helicopter = ownshipIconId('helicopter', 'magenta');
    expect(map.images.has(helicopter)).toBe(true);
    expect(map.layers.get('player-plane')?.layout?.['icon-image']).toContainEqual([
      'image',
      helicopter,
    ]);
  });

  it('removes layers and source cleanly', () => {
    const map = makeMapMock();
    addPlaneLayer(map as unknown as MlMap, position());
    removePlaneLayer(map as unknown as MlMap);
    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
  });
});

describe('altitude cues', () => {
  const kinds = (fc: GeoJSON.FeatureCollection) => fc.features.map((f) => f.properties?.kind);

  it('puts a shadow on the ground south-west of the aircraft, farther the higher it flies', () => {
    const low = createGeoJSON(position({ altitudeAGL: 1000 }));
    const high = createGeoJSON(position({ altitudeAGL: 5000 }));
    expect(kinds(low)).toEqual(['aircraft', 'shadow']);
    const at = (fc: GeoJSON.FeatureCollection) =>
      fc.features.find((f) => f.properties?.kind === 'shadow')!.geometry as GeoJSON.Point;
    const [lng0, lat0] = [8.5, 47.4];
    const lowPt = at(low).coordinates;
    const highPt = at(high).coordinates;
    expect(lowPt[0]!).toBeLessThan(lng0);
    expect(lowPt[1]!).toBeLessThan(lat0);
    expect(Math.hypot(highPt[0]! - lng0, highPt[1]! - lat0)).toBeGreaterThan(
      Math.hypot(lowPt[0]! - lng0, lowPt[1]! - lat0)
    );
  });

  it('shows nothing on the ground, when switched off, and caps the shadow offset', () => {
    expect(kinds(createGeoJSON(position({ altitudeAGL: 10 })))).toEqual(['aircraft']);
    expect(kinds(createGeoJSON(position({ altitudeAGL: 5000 }), false))).toEqual(['aircraft']);
    const at = (agl: number) =>
      createGeoJSON(position({ altitudeAGL: agl })).features.find(
        (f) => f.properties?.kind === 'shadow'
      )!.geometry as GeoJSON.Point;
    expect(at(30000).coordinates).toEqual(at(60000).coordinates);
  });

  it('marks a climb or descent in the label past 300 fpm', () => {
    const trend = (verticalSpeed: number) =>
      createGeoJSON(position({ verticalSpeed })).features[0]!.properties?.trend;
    expect(trend(100)).toBe('');
    expect(trend(800)).toBe(' ▲');
    expect(trend(-800)).toBe(' ▼');
  });

  it('builds without the shadow layer when the cue is off', () => {
    const map = makeMapMock();
    addPlaneLayer(map as unknown as MlMap, position(), {
      size: 'medium',
      color: 'magenta',
      altitudeCues: false,
    });
    expect([...map.layers.keys()]).toEqual(['player-plane', 'player-plane-label']);
  });
});
