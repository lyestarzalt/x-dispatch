import { beforeEach, describe, expect, it } from 'vitest';
import { useMeasureStore } from './measureStore';

const paris = { latitude: 48.86, longitude: 2.35 };
const london = { latitude: 51.47, longitude: -0.46 };
const newYork = { latitude: 40.71, longitude: -73.98 };

describe('measureStore', () => {
  beforeEach(() => {
    useMeasureStore.getState().clear();
  });

  it('start opens a draft with the start fixed and a following end', () => {
    useMeasureStore.getState().start(paris, null);
    const s = useMeasureStore.getState();
    expect(s.placing).toBe(true);
    expect(s.draft).toEqual({ points: [paris, paris], snap: null });
    expect(s.line).toBeNull();
  });

  it('moveEnd moves only the following point', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(newYork);
    expect(useMeasureStore.getState().draft?.points).toEqual([paris, newYork]);
  });

  it('addPoint fixes the following point and starts a new leg from it', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(london);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().moveEnd(newYork);
    expect(useMeasureStore.getState().draft?.points).toEqual([paris, london, newYork]);
  });

  it('finish keeps the fixed points, drops the following point and duplicate clicks', () => {
    useMeasureStore.getState().start(paris, { kind: 'airport', label: 'LFPG' });
    useMeasureStore.getState().moveEnd(london);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().moveEnd(newYork);
    // A double-click lands two clicks on the same spot before the dblclick fires.
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().addPoint();
    expect(useMeasureStore.getState().finish()).toBe(true);
    const s = useMeasureStore.getState();
    expect(s.placing).toBe(false);
    expect(s.draft).toBeNull();
    expect(s.line).toEqual({
      points: [paris, london, newYork],
      snap: { kind: 'airport', label: 'LFPG' },
    });
  });

  it('finish discards a draft with fewer than two distinct points and keeps the previous line', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(newYork);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().finish();
    useMeasureStore.getState().start(newYork, null);
    useMeasureStore.getState().moveEnd({ latitude: 40.710000001, longitude: -73.98 });
    useMeasureStore.getState().addPoint();
    expect(useMeasureStore.getState().finish()).toBe(false);
    expect(useMeasureStore.getState().line?.points[0]).toEqual(paris);
    expect(useMeasureStore.getState().placing).toBe(false);
  });

  it('cancel drops the draft and keeps the existing line', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(newYork);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().finish();
    useMeasureStore.getState().start(newYork, null);
    useMeasureStore.getState().cancel();
    expect(useMeasureStore.getState().draft).toBeNull();
    expect(useMeasureStore.getState().line?.points[0]).toEqual(paris);
  });

  it('setPoint moves one vertex of the placed line and setSnap replaces the anchor', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(newYork);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().finish();
    useMeasureStore.getState().setPoint(1, london);
    useMeasureStore.getState().setSnap({ kind: 'airport', label: 'LFPG' });
    expect(useMeasureStore.getState().line).toEqual({
      points: [paris, london],
      snap: { kind: 'airport', label: 'LFPG' },
    });
  });

  it('removePoint drops a vertex but never below two points', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(london);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().moveEnd(newYork);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().finish();
    useMeasureStore.getState().removePoint(1);
    expect(useMeasureStore.getState().line?.points).toEqual([paris, newYork]);
    useMeasureStore.getState().removePoint(0);
    expect(useMeasureStore.getState().line?.points).toEqual([paris, newYork]);
  });

  it('clear removes everything', () => {
    useMeasureStore.getState().start(paris, null);
    useMeasureStore.getState().moveEnd(newYork);
    useMeasureStore.getState().addPoint();
    useMeasureStore.getState().finish();
    useMeasureStore.getState().clear();
    expect(useMeasureStore.getState().line).toBeNull();
  });
});
