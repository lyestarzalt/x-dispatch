/**
 * The settings main applies to the detached flight strip window. The renderer
 * owns them in the settings store and pushes every change; main keeps the last
 * set and uses the defaults until the first push.
 */
export interface FlightStripWindowOptions {
  /** Clicks pass through to the simulator; only the lock grip still takes them. */
  locked: boolean;
  /** 0.3 to 1. Electron cannot change window opacity on Linux. */
  opacity: number;
  /** Stays above a fullscreen simulator. */
  alwaysOnTop: boolean;
}

export const DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS: FlightStripWindowOptions = {
  locked: false,
  opacity: 1,
  alwaysOnTop: true,
};

export const FLIGHT_STRIP_OPACITY_RANGE = { min: 0.3, max: 1 } as const;

export function clampFlightStripOpacity(opacity: number): number {
  const safe = Number.isFinite(opacity) ? opacity : 1;
  const clamped = Math.max(
    FLIGHT_STRIP_OPACITY_RANGE.min,
    Math.min(FLIGHT_STRIP_OPACITY_RANGE.max, safe)
  );
  return Math.round(clamped * 100) / 100;
}

/** IPC input is untrusted: keep valid values, fall back to the defaults. */
export function parseFlightStripWindowOptions(input: unknown): FlightStripWindowOptions {
  const source =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const out = { ...DEFAULT_FLIGHT_STRIP_WINDOW_OPTIONS };
  if (typeof source.locked === 'boolean') out.locked = source.locked;
  if (typeof source.alwaysOnTop === 'boolean') out.alwaysOnTop = source.alwaysOnTop;
  if (typeof source.opacity === 'number' && Number.isFinite(source.opacity)) {
    out.opacity = clampFlightStripOpacity(source.opacity);
  }
  return out;
}

/** The lock grip in the strip window's content area. */
export interface FlightStripGripRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** IPC input is untrusted: a plausible rect inside a window, or null. */
export function parseGripRect(input: unknown): FlightStripGripRect | null {
  if (typeof input !== 'object' || input === null) return null;
  const { x, y, width, height } = input as Record<string, unknown>;
  const valid = (v: unknown, min: number): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v < 10_000;
  return valid(x, 0) && valid(y, 0) && valid(width, 1) && valid(height, 1)
    ? { x, y, width, height }
    : null;
}

/** The strip reports one rect per set of buttons; more than a few is not a strip. */
const MAX_GRIP_RECTS = 4;

/** IPC input is untrusted: the valid rects of a short list, or none. */
export function parseGripRects(input: unknown): FlightStripGripRect[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_GRIP_RECTS)
    .map(parseGripRect)
    .filter((rect): rect is FlightStripGripRect => rect !== null);
}

/**
 * The grip the strip reports in CSS pixels, in screen (DIP) pixels. Interface Zoom
 * is the page zoom factor, so one CSS pixel is `zoom` DIP.
 */
export function gripRectToScreen(grip: FlightStripGripRect, zoom: number): FlightStripGripRect {
  const factor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    x: grip.x * factor,
    y: grip.y * factor,
    width: grip.width * factor,
    height: grip.height * factor,
  };
}

/**
 * Whether the cursor (screen pixels) is on a grip (the strip has one at each end), given the window's content
 * bounds. Main polls this while locked: forwarded mouse moves are too unreliable on
 * Windows to wait for, and a missed one let the first click pass through the lock.
 */
export function cursorOnGrip(
  cursor: { x: number; y: number },
  content: { x: number; y: number },
  grip: FlightStripGripRect | readonly FlightStripGripRect[] | null
): boolean {
  if (!grip) return false;
  const rects: readonly FlightStripGripRect[] = Array.isArray(grip) ? grip : [grip];
  return rects.some((rect) => {
    const left = content.x + rect.x;
    const top = content.y + rect.y;
    return (
      cursor.x >= left &&
      cursor.y >= top &&
      cursor.x < left + rect.width &&
      cursor.y < top + rect.height
    );
  });
}

/** Locked passes clicks through, except while the pointer is on the grip (`capture`). */
export function ignoresMouse(options: FlightStripWindowOptions, capture: boolean): boolean {
  return options.locked && !capture;
}

/** The part of BrowserWindow the options touch, so tests can stand in for it. */
export interface FlightStripWindowLike {
  isDestroyed(): boolean;
  setOpacity(opacity: number): void;
  setAlwaysOnTop(flag: boolean, level?: 'screen-saver'): void;
  moveTop(): void;
  setIgnoreMouseEvents(ignore: boolean, options?: { forward?: boolean }): void;
}

/**
 * Applies the options to an open strip window. While ignoring the mouse, moves are
 * still forwarded (Windows and macOS) so hovering the strip can reveal the grip.
 */
export function applyFlightStripWindowOptions(
  win: FlightStripWindowLike,
  options: FlightStripWindowOptions,
  { capture, platform }: { capture: boolean; platform: NodeJS.Platform }
): void {
  if (win.isDestroyed()) return;
  if (platform !== 'linux') win.setOpacity(options.opacity);
  if (options.alwaysOnTop) {
    // The default level sits below a fullscreen simulator.
    win.setAlwaysOnTop(true, 'screen-saver');
    win.moveTop();
  } else {
    win.setAlwaysOnTop(false);
  }
  applyFlightStripMouse(win, options, { capture, platform });
}

/**
 * Only whether clicks pass through. The cursor watch calls this alone: re-raising
 * the window as the cursor reaches the grip could swallow the click that follows.
 */
export function applyFlightStripMouse(
  win: Pick<FlightStripWindowLike, 'isDestroyed' | 'setIgnoreMouseEvents'>,
  options: FlightStripWindowOptions,
  { capture, platform }: { capture: boolean; platform: NodeJS.Platform }
): void {
  if (win.isDestroyed()) return;
  const ignore = ignoresMouse(options, capture);
  // Linux cannot forward mouse moves, so there the grip stays hidden while locked.
  if (ignore && platform !== 'linux') win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(ignore);
}
