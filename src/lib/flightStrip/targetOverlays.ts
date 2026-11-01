import type { PlaneState } from '@/types/xplane';
import type { AircraftIdentity } from './wheelAdjust';

export type OverlayField =
  'apAltitude' | 'apHeading' | 'apAirspeed' | 'apVerticalSpeed' | 'apAirspeedIsMach';

/**
 * An aircraft whose panel keeps its selected values in its own datarefs and
 * leaves X-Plane's autopilot dials untouched. While it is loaded, these datarefs
 * feed the strip's targets instead of the dials.
 */
export interface TargetOverlay {
  id: 'ff777';
  matches: (aircraft: AircraftIdentity) => boolean;
  /** Dataref name to the plane state field it replaces. */
  datarefs: Record<string, OverlayField>;
  /** Reads 0 while the VS window is closed, when the panel shows no VS target. */
  vsOpen?: string;
}

const FF777_MCP = '1-sim/output/mcp';

export const TARGET_OVERLAYS: readonly TargetOverlay[] = [
  {
    id: 'ff777',
    matches: ({ icaoType }) => /^B77[2-9LW]$/i.test(icaoType ?? ''),
    datarefs: {
      [`${FF777_MCP}/alt`]: 'apAltitude',
      [`${FF777_MCP}/hdg`]: 'apHeading',
      [`${FF777_MCP}/spd`]: 'apAirspeed',
      [`${FF777_MCP}/vs`]: 'apVerticalSpeed',
      [`${FF777_MCP}/isMachTrg`]: 'apAirspeedIsMach',
    },
    vsOpen: `${FF777_MCP}/isVsOpen`,
  },
];

export function pickTargetOverlay(aircraft: AircraftIdentity): TargetOverlay | null {
  return TARGET_OVERLAYS.find((overlay) => overlay.matches(aircraft)) ?? null;
}

/** Every dataref the overlay needs subscribed. */
export function overlayDatarefNames(overlay: TargetOverlay): string[] {
  const names = Object.keys(overlay.datarefs);
  return overlay.vsOpen ? [...names, overlay.vsOpen] : names;
}

/** The plane state fields the overlay owns; the dial datarefs must not write them meanwhile. */
export function overlayFields(overlay: TargetOverlay): Set<string> {
  return new Set(Object.values(overlay.datarefs));
}

/**
 * Folds the overlay's latest raw values into the dial fields. A closed VS window
 * leaves the VS target unset, as the panel itself shows nothing there.
 */
export function applyOverlay(
  state: Partial<PlaneState>,
  overlay: TargetOverlay,
  values: Readonly<Record<string, number>>
): void {
  const vsClosed = overlay.vsOpen !== undefined && (values[overlay.vsOpen] ?? 1) < 0.5;
  for (const [name, field] of Object.entries(overlay.datarefs)) {
    const value = values[name];
    if (value === undefined) continue;
    if (field === 'apAirspeedIsMach') state.apAirspeedIsMach = value >= 0.5;
    else if (field === 'apVerticalSpeed') state.apVerticalSpeed = vsClosed ? undefined : value;
    else state[field] = value;
  }
}
