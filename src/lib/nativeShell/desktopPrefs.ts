/**
 * The few settings main needs for window behaviour. The renderer owns the
 * settings store and pushes these; main keeps the last set and uses the
 * defaults until the first push.
 */
export interface DesktopPrefs {
  /** macOS: closing the window hides it and the app stays in the Dock. */
  keepRunningOnClose: boolean;
  /** Bounce the Dock icon or flash the taskbar when something finishes in the background. */
  attention: boolean;
  /** Recent airports in the Dock menu and the Windows jump list. */
  recentAirportsMenu: boolean;
}

export const DEFAULT_DESKTOP_PREFS: DesktopPrefs = {
  keepRunningOnClose: true,
  attention: true,
  recentAirportsMenu: true,
};

/** IPC input is untrusted: keep known booleans, fall back to the defaults. */
export function parseDesktopPrefs(input: unknown): DesktopPrefs {
  const source =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const out = { ...DEFAULT_DESKTOP_PREFS };
  for (const key of Object.keys(out) as (keyof DesktopPrefs)[]) {
    const value = source[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}
