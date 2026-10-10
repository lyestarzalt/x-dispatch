import type { JumpListCategory, MenuItemConstructorOptions } from 'electron';
import { APP_URL_SCHEME } from './appUrl';

/** Airports recently opened, newest first, for the dock menu and the jump list. */
export interface RecentAirport {
  icao: string;
  name: string;
}

export const RECENT_AIRPORTS_LIMIT = 8;
const ICAO_RE = /^[A-Z0-9]{2,7}$/;

/** Adds or moves an airport to the front, capped. */
export function addRecentAirport(
  list: readonly RecentAirport[],
  entry: RecentAirport,
  limit = RECENT_AIRPORTS_LIMIT
): RecentAirport[] {
  const icao = entry.icao.toUpperCase();
  const rest = list.filter((a) => a.icao !== icao);
  return [{ icao, name: entry.name }, ...rest].slice(0, limit);
}

/** A list read back from disk: keep well-formed entries, drop the rest. */
export function parseRecentAirports(input: unknown): RecentAirport[] {
  if (!Array.isArray(input)) return [];
  const out: RecentAirport[] = [];
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue;
    const { icao, name } = item as Record<string, unknown>;
    if (typeof icao !== 'string' || !ICAO_RE.test(icao)) continue;
    out.push({ icao, name: typeof name === 'string' ? name.slice(0, 80) : '' });
    if (out.length >= RECENT_AIRPORTS_LIMIT) break;
  }
  return out;
}

function itemLabel(airport: RecentAirport): string {
  return airport.name ? `${airport.icao} — ${airport.name}` : airport.icao;
}

/** macOS dock menu: one item per airport, clicking opens it in the running app. */
export function buildDockMenuTemplate(
  recents: readonly RecentAirport[],
  labels: { recentAirports: string },
  onPick: (icao: string) => void
): MenuItemConstructorOptions[] {
  if (recents.length === 0) return [];
  return [
    { label: labels.recentAirports, enabled: false },
    ...recents.map((airport) => ({
      label: itemLabel(airport),
      click: () => onPick(airport.icao),
    })),
  ];
}

/**
 * Windows jump list: each entry launches the exe with the airport's link,
 * which the single-instance lock turns into an action for the running app.
 */
export function buildJumpListCategories(
  recents: readonly RecentAirport[],
  labels: { recentAirports: string },
  exePath: string
): JumpListCategory[] {
  if (recents.length === 0) return [];
  return [
    {
      type: 'custom',
      name: labels.recentAirports,
      items: recents.map((airport) => ({
        type: 'task',
        title: itemLabel(airport),
        description: airport.name || airport.icao,
        program: exePath,
        args: `${APP_URL_SCHEME}://airport/${airport.icao}`,
        iconPath: exePath,
        iconIndex: 0,
      })),
    },
  ];
}
