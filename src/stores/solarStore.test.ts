import { beforeEach, describe, expect, it } from 'vitest';
import { subsolarPoint } from '@/lib/map/solar/solarPosition';
import { useSolarStore } from './solarStore';

const T0 = Date.UTC(2026, 2, 20, 12, 0);
const T1 = Date.UTC(2026, 2, 20, 18, 0);

describe('solarStore preview', () => {
  beforeEach(() => {
    useSolarStore.getState().setPreview(null);
    useSolarStore.getState().setClock(T0, 'system');
  });

  it('lights the map for the previewed time at once', () => {
    useSolarStore.getState().setPreview(T1);
    const state = useSolarStore.getState();
    expect(state.previewMs).toBe(T1);
    expect(state.timeMs).toBe(T1);
    expect(state.subsolar).toEqual(subsolarPoint(T1));
    expect(state.source).toBe('system');
  });

  it('keeps the last lit time when the preview is cleared, until the clock ticks', () => {
    useSolarStore.getState().setPreview(T1);
    useSolarStore.getState().setPreview(null);
    expect(useSolarStore.getState().previewMs).toBeNull();
    expect(useSolarStore.getState().timeMs).toBe(T1);
    useSolarStore.getState().setClock(T0, 'sim');
    expect(useSolarStore.getState().timeMs).toBe(T0);
    expect(useSolarStore.getState().source).toBe('sim');
  });
});
