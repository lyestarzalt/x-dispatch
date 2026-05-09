import { ipcMain, shell } from 'electron';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import logger from '@/lib/utils/logger';

const TAIL_BYTES = 5_000_000;

export type XPLogReadResult =
  | { kind: 'no-path' }
  | { kind: 'no-log' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: string; fullByteSize: number; truncated: boolean };

export async function readXPlaneLog(xplanePath: string | null): Promise<XPLogReadResult> {
  if (!xplanePath) return { kind: 'no-path' };

  const logPath = path.join(xplanePath, 'Log.txt');

  let stats;
  try {
    stats = await stat(logPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { kind: 'no-log' };
    logger.main.warn(`xp-log:read stat failed: ${(err as Error).message}`);
    return { kind: 'error', message: (err as Error).message };
  }

  try {
    if (stats.size <= TAIL_BYTES) {
      const data = stripBom(await readFile(logPath, 'utf8'));
      return { kind: 'ok', data, fullByteSize: stats.size, truncated: false };
    }
    const stream = createReadStream(logPath, {
      start: stats.size - TAIL_BYTES,
      encoding: 'utf8',
    });
    let raw = '';
    for await (const chunk of stream) raw += chunk;
    // The first line of the tail will almost always be partial — drop everything
    // up to and including the first newline.
    const firstNewline = raw.indexOf('\n');
    const data = stripBom(firstNewline >= 0 ? raw.slice(firstNewline + 1) : raw);
    return { kind: 'ok', data, fullByteSize: stats.size, truncated: true };
  } catch (err) {
    logger.main.warn(`xp-log:read read failed: ${(err as Error).message}`);
    return { kind: 'error', message: (err as Error).message };
  }
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export async function openXPlaneLogExternally(
  xplanePath: string | null
): Promise<{ ok: true } | { ok: false; reason: 'no-path' | 'no-log' | 'error'; message?: string }> {
  if (!xplanePath) return { ok: false, reason: 'no-path' };
  const logPath = path.join(xplanePath, 'Log.txt');
  try {
    await stat(logPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, reason: 'no-log' };
    }
    logger.main.warn(`xp-log:openExternal stat failed: ${(err as Error).message}`);
    return { ok: false, reason: 'error', message: (err as Error).message };
  }
  const errMsg = await shell.openPath(logPath);
  if (errMsg) {
    logger.main.warn(`xp-log:openExternal openPath failed: ${errMsg}`);
    return { ok: false, reason: 'error', message: errMsg };
  }
  return { ok: true };
}

export function registerXPlaneLogIPC(getXPlanePath: () => string | null): void {
  ipcMain.handle('xp-log:read', () => readXPlaneLog(getXPlanePath()));
  ipcMain.handle('xp-log:openExternal', () => openXPlaneLogExternally(getXPlanePath()));
}
