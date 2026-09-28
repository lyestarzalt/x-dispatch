import { describe, expect, it } from 'vitest';
import {
  GEO_SATELLITES,
  cloudAlpha,
  composeCloudTile,
  gibsTileUrl,
  satellitesForTile,
} from './cloudTiles';

const SIZE = 8;

function solidTile(r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  const px = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  }
  return px;
}

describe('cloudAlpha', () => {
  it('is clear for warm surfaces and opaque for cold tops', () => {
    expect(cloudAlpha(25)).toBe(0);
    expect(cloudAlpha(-60)).toBe(1);
    expect(cloudAlpha(-10)).toBeGreaterThan(0);
    expect(cloudAlpha(-10)).toBeLessThan(1);
  });
});

describe('satellitesForTile', () => {
  it('picks Himawari over Southeast Asia and GOES-East over the Atlantic', () => {
    expect(satellitesForTile(3, 6).map((s) => s.layer)).toEqual([
      'Himawari_AHI_Band13_Clean_Infrared',
    ]);
    expect(satellitesForTile(3, 2).map((s) => s.layer)).toContain(
      'GOES-East_ABI_Band13_Clean_Infrared'
    );
  });

  it('uses every satellite for the whole-world tile', () => {
    expect(satellitesForTile(0, 0)).toHaveLength(GEO_SATELLITES.length);
  });
});

describe('gibsTileUrl', () => {
  it('puts the row before the column', () => {
    expect(gibsTileUrl('L', 3, 6, 2)).toMatch(
      /\/L\/default\/default\/GoogleMapsCompatible_Level6\/3\/2\/6\.png$/
    );
  });
});

describe('composeCloudTile', () => {
  const sats = satellitesForTile(3, 6);

  it('turns a warm grey surface transparent', () => {
    const out = composeCloudTile(3, 6, sats, [solidTile(90, 90, 90)], SIZE);
    expect(out[3]).toBe(0);
  });

  it('turns a cold saturated core into opaque white', () => {
    const out = composeCloudTile(3, 6, sats, [solidTile(255, 0, 0)], SIZE);
    expect([out[0], out[1], out[2], out[3]]).toEqual([255, 255, 255, 255]);
  });

  it('reads a dark grey next to a storm core as cold', () => {
    const src = solidTile(76, 76, 76);
    src.set([255, 0, 0, 255], 0);
    const out = composeCloudTile(3, 6, sats, [src], SIZE);
    expect(out[4 + 3]).toBe(255);
    expect(out[(SIZE * SIZE - 1) * 4 + 3]).toBe(0);
  });

  it('keeps warm sea next to a low cloud edge clear', () => {
    const src = solidTile(85, 85, 85);
    src.set([0, 204, 227, 255], 0);
    const out = composeCloudTile(3, 6, sats, [src], SIZE);
    expect(out[4 + 3]).toBe(0);
  });

  it('leaves no-data and failed tiles transparent', () => {
    expect(composeCloudTile(3, 6, sats, [solidTile(0, 0, 0, 0)], SIZE)[3]).toBe(0);
    expect(composeCloudTile(3, 6, sats, [null], SIZE)[3]).toBe(0);
  });
});
