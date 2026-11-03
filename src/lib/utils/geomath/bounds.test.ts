import { describe, expect, it } from 'vitest';
import { boundsAroundPoint } from './bounds';

describe('boundsAroundPoint', () => {
  it('uses radius/60 degrees of latitude', () => {
    const b = boundsAroundPoint(0, 10, 60);
    expect(b.maxLat - b.minLat).toBeCloseTo(2, 5);
    expect(b.maxLon - b.minLon).toBeCloseTo(2, 5);
  });

  it('widens the longitude buffer by 1/cos(lat) away from the equator', () => {
    // McGrath: at 63°N a degree of longitude is only ~27 NM, so a 50 NM circle
    // needs ±1.84° of longitude, not ±0.83°.
    const b = boundsAroundPoint(62.95, -155.6, 50);
    const expected = (2 * 50) / 60 / Math.cos((62.95 * Math.PI) / 180);
    expect(b.maxLon - b.minLon).toBeCloseTo(expected, 4);
    expect(b.maxLat - b.minLat).toBeCloseTo((2 * 50) / 60, 5);
  });

  it('covers all longitudes near the poles and clamps latitude', () => {
    const b = boundsAroundPoint(89.8, 0, 60);
    expect(b.maxLat).toBe(90);
    expect(b.minLon).toBe(-180);
    expect(b.maxLon).toBe(180);
  });
});
