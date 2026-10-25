import { describe, expect, it } from 'vitest';
import { type DockRect, NO_PADDING, dockPadding, samePadding } from './useMapPadding';

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const MAP = box(0, 0, 1600, 900);

describe('dockPadding', () => {
  it('is zero with nothing docked', () => {
    expect(dockPadding(MAP, [])).toEqual(NO_PADDING);
  });

  it('pads each side by how far the panel reaches in, plus the gap', () => {
    const docks: DockRect[] = [
      { side: 'left', rect: box(16, 64, 416, 800) }, // planner
      { side: 'right', rect: box(1264, 64, 320, 800) }, // airport panel
      { side: 'top', rect: box(16, 16, 1568, 84) }, // toolbar + strip
      { side: 'bottom', rect: box(200, 760, 1200, 124) }, // profile strip
    ];
    expect(dockPadding(MAP, docks, 12)).toEqual({
      left: 432 + 12,
      right: 336 + 12,
      top: 100 + 12,
      bottom: 140 + 12,
    });
  });

  it('keeps the furthest panel when two share a side', () => {
    const docks: DockRect[] = [
      { side: 'left', rect: box(16, 64, 48, 300) }, // collapsed flight info
      { side: 'left', rect: box(16, 64, 416, 800) }, // planner
    ];
    expect(dockPadding(MAP, docks, 0).left).toBe(432);
  });

  it('ignores a panel that is not drawn', () => {
    expect(dockPadding(MAP, [{ side: 'left', rect: box(16, 64, 0, 0) }])).toEqual(NO_PADDING);
  });

  it('never lets one axis lose more than two thirds of the map', () => {
    const docks: DockRect[] = [
      { side: 'left', rect: box(0, 0, 900, 900) },
      { side: 'right', rect: box(700, 0, 900, 900) },
    ];
    const padding = dockPadding(MAP, docks, 0);
    expect(padding.left).toBeCloseTo(1600 / 3);
    expect(padding.right).toBeCloseTo(1600 / 3);
  });
});

describe('samePadding', () => {
  it('treats sub-pixel differences as equal', () => {
    expect(samePadding({ ...NO_PADDING, left: 100.2 }, { ...NO_PADDING, left: 100.4 })).toBe(true);
    expect(samePadding({ ...NO_PADDING, left: 100 }, { ...NO_PADDING, left: 101 })).toBe(false);
  });
});
