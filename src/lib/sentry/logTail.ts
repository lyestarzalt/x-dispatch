import * as fs from 'fs';

/** 64 KB keeps the envelope small while covering a few minutes of a busy session. */
export const LOG_TAIL_MAX_BYTES = 64 * 1024;

/**
 * The end of the app log, read synchronously so it can run inside Sentry's
 * `beforeSend`. Starts on a line boundary when the file was cut, and returns
 * null for a missing or empty file so the caller attaches nothing.
 */
export function readLogTail(logPath: string, maxBytes = LOG_TAIL_MAX_BYTES): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(logPath, 'r');
    const { size } = fs.fstatSync(fd);
    if (size === 0) return null;
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    let text = buffer.toString('utf-8');
    if (length < size) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) text = text.slice(firstNewline + 1);
    }
    return text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}
