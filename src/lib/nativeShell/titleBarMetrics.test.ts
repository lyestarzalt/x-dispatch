import { describe, expect, it } from 'vitest';
import { titleBarMetrics } from './titleBarMetrics';

describe('titleBarMetrics', () => {
  it('uses the native sizes at 100% zoom', () => {
    expect(titleBarMetrics(1)).toEqual({ heightPx: 36, trafficLightInsetPx: 78 });
  });

  it('grows in CSS pixels when zoomed out so the native traffic lights stay clear', () => {
    const m = titleBarMetrics(0.8);
    expect(m.trafficLightInsetPx * 0.8).toBeCloseTo(78);
    expect(m.heightPx * 0.8).toBeCloseTo(36);
  });

  it('shrinks in CSS pixels when zoomed in, keeping the same on-screen size', () => {
    const m = titleBarMetrics(1.5);
    expect(m.trafficLightInsetPx * 1.5).toBeCloseTo(78);
    expect(m.heightPx * 1.5).toBeCloseTo(36);
  });

  it('falls back to native sizes for a nonsensical zoom', () => {
    expect(titleBarMetrics(0)).toEqual({ heightPx: 36, trafficLightInsetPx: 78 });
    expect(titleBarMetrics(Number.NaN)).toEqual({ heightPx: 36, trafficLightInsetPx: 78 });
  });
});
