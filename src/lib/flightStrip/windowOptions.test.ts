import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS,
  type FlightStripWindowLike,
  applyFlightStripWindowOptions,
  cursorOnGrip,
  gripRectToScreen,
  ignoresMouse,
  parseFlightStripWindowOptions,
  parseGripRect,
  parseGripRects,
} from './windowOptions';

function fakeWindow() {
  const calls: string[] = [];
  const win: FlightStripWindowLike = {
    isDestroyed: () => false,
    setOpacity: (opacity) => calls.push(`opacity ${opacity}`),
    setAlwaysOnTop: (flag, level) => calls.push(`top ${flag}${level ? ` ${level}` : ''}`),
    moveTop: () => calls.push('moveTop'),
    setIgnoreMouseEvents: (ignore, options) =>
      calls.push(`ignore ${ignore}${options?.forward ? ' forward' : ''}`),
  };
  return { win, calls };
}

describe('parseFlightStripWindowOptions', () => {
  it('keeps valid values and clamps the opacity', () => {
    expect(
      parseFlightStripWindowOptions({ locked: true, opacity: 0.1, alwaysOnTop: false })
    ).toEqual({ locked: true, opacity: 0.3, alwaysOnTop: false });
  });

  it('falls back to the defaults for anything unreadable', () => {
    expect(parseFlightStripWindowOptions('nope')).toEqual(DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS);
    expect(parseFlightStripWindowOptions({ locked: 'yes', opacity: NaN })).toEqual(
      DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS
    );
  });
});

describe('ignoresMouse', () => {
  it('passes clicks through only while locked and not over the grip', () => {
    expect(ignoresMouse({ ...DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS, locked: true }, false)).toBe(
      true
    );
    expect(ignoresMouse({ ...DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS, locked: true }, true)).toBe(
      false
    );
    expect(ignoresMouse({ ...DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS, locked: false }, false)).toBe(
      false
    );
  });
});

describe('applyFlightStripWindowOptions', () => {
  const locked = { locked: true, opacity: 0.8, alwaysOnTop: true };

  it('locks with forwarded mouse moves so the grip can still appear', () => {
    const { win, calls } = fakeWindow();
    applyFlightStripWindowOptions(win, locked, { capture: false, platform: 'win32' });
    expect(calls).toEqual([
      'opacity 0.8',
      'top true screen-saver',
      'moveTop',
      'ignore true forward',
    ]);
  });

  it('takes clicks again while the pointer is on the grip', () => {
    const { win, calls } = fakeWindow();
    applyFlightStripWindowOptions(win, locked, { capture: true, platform: 'darwin' });
    expect(calls).toContain('ignore false');
  });

  it('drops the topmost level when always on top is off', () => {
    const { win, calls } = fakeWindow();
    applyFlightStripWindowOptions(
      win,
      { locked: false, opacity: 1, alwaysOnTop: false },
      { capture: false, platform: 'win32' }
    );
    expect(calls).toEqual(['opacity 1', 'top false', 'ignore false']);
  });

  it('leaves opacity alone on Linux, where Electron cannot set it', () => {
    const { win, calls } = fakeWindow();
    applyFlightStripWindowOptions(win, locked, { capture: false, platform: 'linux' });
    expect(calls).toEqual(['top true screen-saver', 'moveTop', 'ignore true']);
  });

  it('does nothing to a destroyed window', () => {
    const { win, calls } = fakeWindow();
    applyFlightStripWindowOptions({ ...win, isDestroyed: () => true }, locked, {
      capture: false,
      platform: 'win32',
    });
    expect(calls).toEqual([]);
  });
});

describe('parseGripRect', () => {
  it('keeps a valid rect', () => {
    expect(parseGripRect({ x: 1400, y: 4, width: 28, height: 24 })).toEqual({
      x: 1400,
      y: 4,
      width: 28,
      height: 24,
    });
  });

  it('rejects anything else', () => {
    for (const input of [
      null,
      true,
      {},
      { x: 1, y: 1, width: 0, height: 5 },
      { x: -1, y: 0, width: 5, height: 5 },
    ]) {
      expect(parseGripRect(input)).toBeNull();
    }
  });
});

// The strip has its buttons at both ends (GitHub #401), so it reports two areas.
describe('parseGripRects', () => {
  const left = { x: 4, y: 4, width: 20, height: 60 };
  const right = { x: 1400, y: 4, width: 20, height: 60 };

  it('keeps every valid rect and drops the rest', () => {
    expect(parseGripRects([left, { x: -1, y: 0, width: 5, height: 5 }, right])).toEqual([
      left,
      right,
    ]);
  });

  it('takes nothing from anything that is not a short list', () => {
    expect(parseGripRects(null)).toEqual([]);
    expect(parseGripRects(left)).toEqual([]);
    expect(parseGripRects(Array.from({ length: 50 }, () => left))).toHaveLength(4);
  });
});

describe('gripRectToScreen', () => {
  it('scales CSS pixels by the zoom factor', () => {
    expect(gripRectToScreen({ x: 1440, y: 57, width: 43, height: 43 }, 1.25)).toEqual({
      x: 1800,
      y: 71.25,
      width: 53.75,
      height: 53.75,
    });
  });

  it('keeps the rect for a missing or invalid zoom factor', () => {
    const grip = { x: 1440, y: 57, width: 43, height: 43 };
    expect(gripRectToScreen(grip, 1)).toEqual(grip);
    expect(gripRectToScreen(grip, 0)).toEqual(grip);
    expect(gripRectToScreen(grip, Number.NaN)).toEqual(grip);
  });
});

describe('cursorOnGrip', () => {
  const content = { x: 100, y: 50, width: 1000, height: 120 };
  const grip = { x: 960, y: 4, width: 24, height: 24 };

  it('finds the cursor on the grip, in screen pixels', () => {
    expect(cursorOnGrip({ x: 1060, y: 54 }, content, grip)).toBe(true);
    expect(cursorOnGrip({ x: 1083, y: 77 }, content, grip)).toBe(true);
  });

  it('is off the grip anywhere else, the rest of the strip included', () => {
    expect(cursorOnGrip({ x: 1059, y: 60 }, content, grip)).toBe(false);
    expect(cursorOnGrip({ x: 1084, y: 60 }, content, grip)).toBe(false);
    expect(cursorOnGrip({ x: 1070, y: 78 }, content, grip)).toBe(false);
    expect(cursorOnGrip({ x: 500, y: 100 }, content, grip)).toBe(false);
  });

  it('is off the grip before the strip has reported one', () => {
    expect(cursorOnGrip({ x: 1060, y: 54 }, content, null)).toBe(false);
  });
});

describe('cursorOnGrip with buttons at both ends', () => {
  const content = { x: 1000, y: 50 };
  const grips = [
    { x: 4, y: 4, width: 20, height: 60 },
    { x: 400, y: 4, width: 20, height: 60 },
  ];

  it('is on the grip over either area and off it between them', () => {
    expect(cursorOnGrip({ x: 1010, y: 60 }, content, grips)).toBe(true);
    expect(cursorOnGrip({ x: 1410, y: 60 }, content, grips)).toBe(true);
    expect(cursorOnGrip({ x: 1200, y: 60 }, content, grips)).toBe(false);
    expect(cursorOnGrip({ x: 1010, y: 60 }, content, [])).toBe(false);
  });
});
