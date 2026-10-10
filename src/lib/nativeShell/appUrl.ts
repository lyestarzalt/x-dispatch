/**
 * `xdispatch://` URLs and what the app does with them.
 *
 * One parser for every entry point: the website's links, a cold-start
 * argument on Windows and Linux, macOS `open-url`, and a second instance.
 * Every field is validated here so the renderer never sees free text from a
 * link. Anything that does not match is dropped, never partially applied.
 */
import { isSimbriefUser } from '@/lib/simbrief/ofp';

export const APP_URL_SCHEME = 'xdispatch';

/** Longest URL we read at all; a link is a handful of fields, not a document. */
const MAX_URL_LENGTH = 2048;

export const AIRPORT_PANEL_TABS = ['info', 'start', 'proc'] as const;
export type AirportPanelTab = (typeof AIRPORT_PANEL_TABS)[number];

export const SETTINGS_TABS = [
  'xplane',
  'data',
  'appearance',
  'units',
  'graphics',
  'flights',
  'airports',
  'simbrief',
  'companion-apps',
  'tablet',
  'logs',
  'support',
  'about',
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const ADDON_MANAGER_TABS = ['scenery', 'installed', 'installer'] as const;
export type AddonManagerTab = (typeof ADDON_MANAGER_TABS)[number];

/** Where a link came from; only ever reported as this enum. */
export const APP_ACTION_SOURCES = ['website', 'discord', 'manual'] as const;
export type AppActionSource = (typeof APP_ACTION_SOURCES)[number];

export type AppActionPayload =
  | { kind: 'airport'; icao: string; tab?: AirportPanelTab; runway?: string }
  | { kind: 'route'; from?: string; to?: string; via?: string }
  | { kind: 'simbrief'; pilotId?: string }
  | { kind: 'import-url'; url: string }
  /** A local file the OS handed us (double-click, Open With); never from a URL. */
  | { kind: 'import-file'; path: string }
  | { kind: 'launch'; icao?: string; aircraft?: string }
  | { kind: 'settings'; tab?: SettingsTab }
  | { kind: 'logs' }
  | { kind: 'update' }
  | { kind: 'addon'; tab?: AddonManagerTab };

export type AppActionKind = AppActionPayload['kind'];

export type AppAction = AppActionPayload & { source?: AppActionSource };

export const APP_ACTION_KINDS = [
  'airport',
  'route',
  'simbrief',
  'import-url',
  'import-file',
  'launch',
  'settings',
  'logs',
  'update',
  'addon',
] as const satisfies readonly AppActionKind[];

/** X-Plane airport IDs: ICAO codes and the longer IDs custom scenery uses. */
const ICAO_RE = /^[A-Z0-9]{2,7}$/;
/** "05", "23L", "36C"; helipads and water runways are not start positions a link needs. */
const RUNWAY_RE = /^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$/;
/** A filed route: fixes, airways, DCT, lat/lon fixes. */
const ROUTE_RE = /^[A-Z0-9 /.-]{1,512}$/;
/** Aircraft names as X-Plane scans them: "Cessna 172", "ToLiss A321 (XP12)". */
const AIRCRAFT_NAME_RE = /^[\w .'()/&+-]{1,80}$/;
const MAX_REMOTE_URL_LENGTH = 1024;

function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined {
  if (value === null) return undefined;
  const lower = value.toLowerCase();
  return values.find((v) => v === lower);
}

function icaoOf(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  return ICAO_RE.test(upper) ? upper : undefined;
}

function runwayOf(value: string | null): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  return RUNWAY_RE.test(upper) ? upper : undefined;
}

function routeOf(value: string | null): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase().replace(/\s+/g, ' ');
  return ROUTE_RE.test(upper) ? upper : undefined;
}

function aircraftOf(value: string | null): string | undefined {
  if (!value) return undefined;
  const name = value.trim();
  return AIRCRAFT_NAME_RE.test(name) ? name : undefined;
}

/**
 * A remote file the user will be asked to download: https only, no
 * credentials, short enough to show in a dialog.
 */
export function remoteFileUrlOf(value: string | null): string | undefined {
  if (!value || value.length > MAX_REMOTE_URL_LENGTH) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') return undefined;
  if (!parsed.hostname || parsed.username || parsed.password) return undefined;
  return parsed.toString();
}

/** The first path segment, so `/about` and `/about/` both read as "about". */
function firstSegment(pathname: string): string | null {
  const segment = pathname.split('/').find(Boolean);
  return segment ? decodeURIComponent(segment) : null;
}

/**
 * Turns an `xdispatch://` URL into an action, or null when it is not one we
 * handle. A URL with a known host but an invalid required field is also null:
 * a link is applied whole or not at all.
 */
export function parseAppUrl(input: string): AppAction | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_URL_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_URL_SCHEME}:`) return null;

  const host = url.host.toLowerCase();
  const params = url.searchParams;
  const segment = firstSegment(url.pathname);
  const source = oneOf(APP_ACTION_SOURCES, params.get('src'));
  const withSource = (payload: AppActionPayload): AppAction =>
    source ? { ...payload, source } : payload;

  switch (host) {
    case 'airport': {
      const icao = icaoOf(segment ?? params.get('icao'));
      if (!icao) return null;
      const tab = oneOf(AIRPORT_PANEL_TABS, params.get('tab'));
      const runway = runwayOf(params.get('rwy'));
      return withSource({
        kind: 'airport',
        icao,
        ...(tab ? { tab } : {}),
        ...(runway ? { runway } : {}),
      });
    }
    case 'route': {
      const from = icaoOf(params.get('from'));
      const to = icaoOf(params.get('to'));
      const via = routeOf(params.get('via'));
      if (!from && !to && !via) return null;
      return withSource({
        kind: 'route',
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(via ? { via } : {}),
      });
    }
    case 'simbrief': {
      const user = params.get('user');
      if (user !== null && !isSimbriefUser(user)) return null;
      return withSource({
        kind: 'simbrief',
        ...(user !== null ? { pilotId: user.trim() } : {}),
      });
    }
    case 'import': {
      const remote = remoteFileUrlOf(params.get('url'));
      if (!remote) return null;
      return withSource({ kind: 'import-url', url: remote });
    }
    case 'launch': {
      const icao = icaoOf(params.get('airport'));
      const aircraft = aircraftOf(params.get('aircraft'));
      return withSource({
        kind: 'launch',
        ...(icao ? { icao } : {}),
        ...(aircraft ? { aircraft } : {}),
      });
    }
    case 'settings': {
      const tab = oneOf(SETTINGS_TABS, segment ?? params.get('tab'));
      return withSource({ kind: 'settings', ...(tab ? { tab } : {}) });
    }
    case 'logs':
      return withSource({ kind: 'logs' });
    case 'update':
      return withSource({ kind: 'update' });
    case 'addon': {
      const tab = oneOf(ADDON_MANAGER_TABS, segment ?? params.get('tab'));
      return withSource({ kind: 'addon', ...(tab ? { tab } : {}) });
    }
    default:
      return null;
  }
}

/**
 * The app URL a cold start or second instance was launched with, if any.
 * Chromium adds its own switches to argv, so only a token that is a valid
 * app URL counts; everything else is ignored.
 */
export function findAppUrlInArgv(argv: readonly string[]): string | null {
  const prefix = `${APP_URL_SCHEME}://`;
  for (const arg of argv) {
    if (typeof arg !== 'string' || !arg.startsWith(prefix)) continue;
    if (parseAppUrl(arg)) return arg;
  }
  return null;
}

/** Host and path of a remote file, for a confirmation dialog. */
export function describeRemoteUrl(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, path: parsed.pathname };
  } catch {
    return { host: url, path: '' };
  }
}
