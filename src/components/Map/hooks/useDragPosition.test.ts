import { describe, expect, it } from 'vitest';
import { clampWidgetPosition } from './useDragPosition';

const viewport = { width: 1600, height: 900 };
const size = { width: 1200, height: 160 };

describe('clampWidgetPosition', () => {
  // GitHub #419: the profile dragged to the top slid under the toolbar, its drag bar
  // out of reach, and the saved spot kept it there after a restart.
  it('keeps a widget below the toolbar', () => {
    expect(clampWidgetPosition({ x: 200, y: 16 }, size, viewport, 72)).toEqual({ x: 200, y: 88 });
  });

  it('brings a position saved under the toolbar back down', () => {
    expect(clampWidgetPosition({ x: 200, y: 0 }, size, viewport, 72).y).toBe(88);
  });

  it('keeps the other edges as before', () => {
    expect(clampWidgetPosition({ x: -50, y: 2000 }, size, viewport, 72)).toEqual({
      x: 16,
      y: 900 - 160 - 16,
    });
    expect(clampWidgetPosition({ x: 5000, y: 300 }, size, viewport, 72).x).toBe(1600 - 1200 - 16);
  });

  it('uses the window edge when there is no toolbar (the detached strip window)', () => {
    expect(clampWidgetPosition({ x: 20, y: 0 }, size, viewport, 0).y).toBe(16);
  });

  // GitHub #425: the map's own buttons run down the left margin; a widget stops beside them.
  it('keeps a widget to the right of the left-margin controls', () => {
    expect(clampWidgetPosition({ x: 0, y: 300 }, size, viewport, 72, 39)).toEqual({
      x: 55,
      y: 300,
    });
    expect(clampWidgetPosition({ x: 200, y: 300 }, size, viewport, 72, 39).x).toBe(200);
  });

  it('prefers the top limit when the window is too short for the widget', () => {
    expect(clampWidgetPosition({ x: 20, y: 0 }, size, { width: 1600, height: 200 }, 72).y).toBe(88);
  });
});
