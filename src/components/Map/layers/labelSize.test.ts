import { describe, expect, it } from 'vitest';
import { metersPerPixel, minZoomForTextOnLine } from './labelSize';

describe('metersPerPixel', () => {
  it('halves with every zoom level and shrinks towards the poles', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(78_184, -1);
    expect(metersPerPixel(0, 1)).toBeCloseTo(metersPerPixel(0, 0) / 2, 5);
    expect(metersPerPixel(60, 10)).toBeCloseTo(metersPerPixel(0, 10) / 2, 5);
  });
});

// DAAG BJA1A: the 2.1 NM heading leg and the 19.5 NM course to BNA, at 36.7 N.
describe('minZoomForTextOnLine', () => {
  const NM = 1852;
  const tenPx = () => 10;
  it('keeps text off a leg that is shorter than it on screen', () => {
    const short = minZoomForTextOnLine(2.1 * NM, 36.7, 16, tenPx);
    const long = minZoomForTextOnLine(19.5 * NM, 36.7, 17, tenPx);
    expect(short).toBeGreaterThan(long);
    // At its first zoom the leg is at least as long as the text; one zoom out it is not.
    const textPx = 16 * 0.58 * 10;
    expect((2.1 * NM) / metersPerPixel(36.7, short)).toBeGreaterThanOrEqual(textPx);
    expect((2.1 * NM) / metersPerPixel(36.7, short - 1)).toBeLessThan(textPx);
  });

  it('never shows text on a line with no length', () => {
    expect(minZoomForTextOnLine(0, 36.7, 10, tenPx)).toBeGreaterThan(22);
  });
});
