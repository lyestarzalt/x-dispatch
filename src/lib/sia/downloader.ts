import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { net } from 'electron';
import logger from '@/lib/utils/logger';
import type { SiaDownloadProgress } from './types';

const DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000; // 1h for large eAIP

export type DownloadProgressCallback = (progress: SiaDownloadProgress) => void;

export async function downloadToFile(
  url: string,
  destPath: string,
  productId: string,
  onProgress?: DownloadProgressCallback
): Promise<{ success: boolean; error?: string }> {
  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  return new Promise((resolve) => {
    const request = net.request(url);
    request.setHeader('User-Agent', 'X-Dispatch-SIA/1.0');
    let received = 0;
    let total = 0;
    const chunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      try {
        request.abort();
      } catch {
        /* */
      }
      settle({ success: false, error: 'Download timeout' });
    }, DOWNLOAD_TIMEOUT_MS);

    const settle = (result: { success: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const emit = (phase: SiaDownloadProgress['phase'], percent: number, message: string) => {
      onProgress?.({ productId, phase, percent, message });
    };

    request.on('response', (response) => {
      const status = response.statusCode ?? 0;
      total = parseInt(response.headers['content-length']?.[0] ?? '0', 10) || 0;

      if (status < 200 || status >= 300) {
        settle({ success: false, error: `HTTP ${status}` });
        return;
      }

      emit('downloading', 0, 'Downloading…');

      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        if (total > 0) {
          emit('downloading', Math.min(99, Math.round((received / total) * 100)), 'Downloading…');
        }
      });

      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await fsp.writeFile(destPath, buffer);
          emit('downloading', 100, 'Download complete');
          settle({ success: true });
        } catch (err) {
          logger.main.error('SIA download write failed', err);
          settle({ success: false, error: (err as Error).message });
        }
      });

      response.on('error', (err: Error) => settle({ success: false, error: err.message }));
    });

    request.on('error', (err: Error) => settle({ success: false, error: err.message }));
    request.end();
  });
}

export function copyLocalZip(sourcePath: string, destPath: string): Promise<void> {
  return fsp.copyFile(sourcePath, destPath);
}

export async function getDirSizeBytes(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else {
        const stat = await fsp.stat(full);
        total += stat.size;
      }
    }
  }
  return total;
}
