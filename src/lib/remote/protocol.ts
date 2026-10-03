/** Frames on the tablet WebSocket. Shared by main and the browser bridge. */
export type ClientFrame =
  | { t: 'req'; id: number; ch: string; args: unknown[] }
  | { t: 'send'; ch: string; args: unknown[] };

export type ServerFrame =
  | { t: 'res'; id: number; ok: true; value: unknown }
  | { t: 'res'; id: number; ok: false; error: { code: string; message: string } }
  | { t: 'ev'; ch: string; args: unknown[] };

export const WS_PATH = '/ws';
export const TILE_PATH_PREFIX = '/tile-cache/';
/** Close code sent when the pairing token no longer matches. */
export const CLOSE_UNAUTHORIZED = 4401;
