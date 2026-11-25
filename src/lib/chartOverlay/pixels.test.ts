import { describe, expect, it } from 'vitest';
import { nightSheet } from './pixels';

const px = (...pixels: [number, number, number, number][]) => new Uint8ClampedArray(pixels.flat());

describe('nightSheet', () => {
  it('turns white paper dark and black ink light, and keeps the page solid', () => {
    const page = px([255, 255, 255, 255], [0, 0, 0, 255]);
    nightSheet(page);
    expect([...page]).toEqual([14, 20, 30, 255, 235, 235, 235, 255]);
  });

  it('puts a terrain tint between paper and ink, nearer the paper', () => {
    const page = px([222, 200, 160, 255]);
    nightSheet(page);
    expect(page[0]).toBeGreaterThan(14);
    expect(page[0]).toBeLessThan(110);
    expect(page[3]).toBe(255);
  });
});
