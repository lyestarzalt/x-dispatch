/**
 * RAR work runs on a worker thread. The RAR engine is WebAssembly driven by a
 * synchronous generator, so listing or extracting a large archive on the main
 * thread freezes every IPC call and the renderer with it (Sentry X-DISPATCH-8Y).
 *
 * The worker is `rarWorker.entry.ts`, built by Forge as `rarWorker.js` beside
 * `main.js` and started from there by path. It loads the RAR module from the
 * path resolved here, which is outside the asar.
 */
import { createRequire } from 'module';
import * as path from 'path';
import { Worker } from 'worker_threads';
import type { ExtractRequest, ListRequest, RarHeader, WorkerMessage } from './rarWorkerProtocol';
import { unpackedBinaryPath } from './sevenZipExtractor';

export type { RarHeader } from './rarWorkerProtocol';

export interface RarListResult {
  headerEncrypted: boolean;
  headers: RarHeader[];
}

/** What the engine threw, with the fields the error mapping reads. */
export interface RarWorkerFailure {
  reason?: string;
  message: string;
}

/**
 * The RAR module's entry file, outside the asar so the worker can read it and
 * its wasm. The main bundle is CommonJS, where `import.meta.url` compiles to
 * undefined; `__filename` is the one name that resolves in the bundle, in
 * development and under the test runner alike.
 */
export function rarModulePath(): string {
  const require = createRequire(__filename);
  return unpackedBinaryPath(require.resolve('node-unrar-js'));
}

/** The built worker file, next to the main bundle. */
export function rarWorkerPath(): string {
  return path.join(__dirname, 'rarWorker.js');
}

function runWorker(
  request: Omit<ListRequest, 'modulePath'> | Omit<ExtractRequest, 'modulePath'>,
  onMessage: (message: WorkerMessage) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(rarWorkerPath(), {
      workerData: { ...request, modulePath: rarModulePath() },
    });
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      if (error === undefined) resolve();
      else reject(error);
    };
    worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'error') {
        const failure: RarWorkerFailure = { reason: message.reason, message: message.message };
        finish(failure);
        return;
      }
      onMessage(message);
      if (message.type === 'done' || message.type === 'list') finish();
    });
    worker.on('error', (error) => finish({ message: String(error) } satisfies RarWorkerFailure));
    worker.on('exit', (code) => {
      if (code !== 0) finish({ message: `RAR worker exited with code ${code}` });
      else finish({ message: 'RAR worker exited before answering' });
    });
  });
}

/** List an archive's entries on a worker thread. Throws a `RarWorkerFailure`. */
export async function listRarInWorker(
  archivePath: string,
  password: string | undefined
): Promise<RarListResult> {
  let result: RarListResult | null = null;
  await runWorker({ mode: 'list', archivePath, password }, (message) => {
    if (message.type === 'list') {
      result = { headerEncrypted: message.headerEncrypted, headers: message.headers };
    }
  });
  if (!result) throw { message: 'RAR worker returned no listing' } satisfies RarWorkerFailure;
  return result;
}

/**
 * Extract `wanted` entries on a worker thread, writing each as `targets` says.
 * `onFile` runs as each entry lands. Throws a `RarWorkerFailure`.
 */
export async function extractRarInWorker(
  options: {
    archivePath: string;
    password: string | undefined;
    targetDir: string;
    wanted: string[];
    targets: Record<string, string>;
  },
  onFile: (name: string) => void
): Promise<void> {
  await runWorker({ mode: 'extract', ...options }, (message) => {
    if (message.type === 'file') onFile(message.name);
  });
}
