import { describe, expect, it } from 'vitest';
import { type DemTileLike, sampleTerrain, tileCoordinate } from './terrainSampler';

/** A fake world: elevation in metres equals the tile's x index times 100, plus the pixel row. */
const fakeTile = (z: number, x: number, _y: number): Promise<DemTileLike> => {
  const width = 4;
  const height = 4;
  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) data[row * width + col] = x * 100 + row;
  }
  void z;
  return Promise.resolve({ width, height, data });
};

describe('tileCoordinate', () => {
  it('maps lon/lat to the standard XYZ tile and a pixel inside it', () => {
    const c = tileCoordinate(0, 0, 1, 256);
    expect(c.x).toBe(1);
    expect(c.y).toBe(1);
    expect(c.px).toBeCloseTo(0, 5);
    expect(c.py).toBeCloseTo(0, 5);
    const w = tileCoordinate(-180, 0, 1, 256);
    expect(w.x).toBe(0);
    expect(w.px).toBeCloseTo(0, 5);
  });
});

describe('sampleTerrain', () => {
  it('samples along each leg, accumulates distance and reports the highest terrain per leg', async () => {
    const legs = [
      { a: { latitude: 0, longitude: 0 }, b: { latitude: 0, longitude: 1 } },
      { a: { latitude: 0, longitude: 1 }, b: { latitude: 0, longitude: 2 } },
    ];
    const result = await sampleTerrain(legs, fakeTile, { zoom: 1, stepNm: 10, corridorNm: 0 });
    const last = result.track[result.track.length - 1]!;
    expect(last.distanceNm).toBeCloseTo(120.08, 1);
    expect(result.track[0]!.distanceNm).toBe(0);
    expect(result.track.length).toBeGreaterThan(10);
    // Every sample here is in tile x=1 (lon 0..180 at z1): 100 m + row -> at least 328 ft.
    for (const p of result.track) expect(p.elevationFt).toBeGreaterThanOrEqual(328);
    expect(result.maxElevationPerLegFt).toHaveLength(2);
    expect(result.maxElevationPerLegFt[0]).toBeGreaterThanOrEqual(328);
  });

  it('looks sideways across the corridor for the per-leg maximum, not for the drawn track', async () => {
    // A tile boundary runs along lon 0 at z1: west of it tile x=0 (0 m), east x=1 (100 m+). The
    // leg runs north just west of it, so the corridor (perpendicular, east-west) crosses it.
    const legs = [
      { a: { latitude: 0, longitude: -0.05 }, b: { latitude: 0.01, longitude: -0.05 } },
    ];
    const narrow = await sampleTerrain(legs, fakeTile, { zoom: 1, stepNm: 0.2, corridorNm: 0 });
    const wide = await sampleTerrain(legs, fakeTile, { zoom: 1, stepNm: 0.2, corridorNm: 10 });
    expect(Math.max(...narrow.track.map((p) => p.elevationFt))).toBeLessThan(100);
    expect(narrow.maxElevationPerLegFt[0]).toBeLessThan(100);
    // The eastern offset lands in tile x=1.
    expect(wide.maxElevationPerLegFt[0]).toBeGreaterThanOrEqual(328);
    // The drawn track itself is unchanged by the corridor.
    expect(wide.track.map((p) => p.elevationFt)).toEqual(narrow.track.map((p) => p.elevationFt));
  });

  it('caps the number of samples on very long routes by widening the step', async () => {
    const legs = [{ a: { latitude: 0, longitude: -170 }, b: { latitude: 0, longitude: 170 } }];
    const result = await sampleTerrain(legs, fakeTile, {
      zoom: 1,
      stepNm: 0.5,
      corridorNm: 0,
      maxSamples: 500,
    });
    expect(result.track.length).toBeLessThanOrEqual(502);
  });

  it('treats a failing or slow tile as sea level instead of failing the whole route', async () => {
    const legs = [{ a: { latitude: 0, longitude: 0 }, b: { latitude: 0, longitude: 1 } }];
    const failing = () => Promise.reject(new Error('404'));
    const errors: string[] = [];
    const result = await sampleTerrain(legs, failing, {
      zoom: 1,
      stepNm: 10,
      corridorNm: 0,
      onTileError: (z, x, y, reason) => errors.push(`${z}/${x}/${y} ${String(reason)}`),
    });
    expect(result.track.length).toBeGreaterThan(2);
    expect(result.track.every((p) => p.elevationFt === 0)).toBe(true);
    expect(result.maxElevationPerLegFt).toEqual([0]);
    expect(errors).toHaveLength(1);
    const hanging = () => new Promise<never>(() => {});
    const slow = await sampleTerrain(legs, hanging, {
      zoom: 1,
      stepNm: 10,
      corridorNm: 0,
      tileTimeoutMs: 20,
    });
    expect(slow.maxElevationPerLegFt).toEqual([0]);
  });
});
