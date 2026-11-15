/**
 * RAR work runs on a worker thread. The RAR engine is WebAssembly driven by a
 * synchronous generator, so listing or extracting a large archive on the main
 * thread freezes every IPC call and the renderer with it (Sentry X-DISPATCH-8Y).
 *
 * The worker is a self-contained script evaluated from a string: the main-process
 * bundle has no second entry point, and a string needs none. It loads the RAR
 * module from the path the main process resolved, which is outside the asar.
 */
import { createRequire } from 'module';
import { Worker } from 'worker_threads';
import { unpackedBinaryPath } from './sevenZipExtractor';

/** One entry of a RAR listing, as the worker reports it. */
export interface RarHeader {
  name: string;
  directory: boolean;
  unpSize: number;
  packSize: number;
  encrypted: boolean;
}

export interface RarListResult {
  headerEncrypted: boolean;
  headers: RarHeader[];
}

/** What the engine threw, with the fields the error mapping reads. */
export interface RarWorkerFailure {
  reason?: string;
  message: string;
}

interface ListRequest {
  mode: 'list';
  modulePath: string;
  archivePath: string;
  password?: string;
}

interface ExtractRequest {
  mode: 'extract';
  modulePath: string;
  archivePath: string;
  password?: string;
  targetDir: string;
  /** Archive entry names to extract. */
  wanted: string[];
  /** Archive entry name (with `/` separators) to the relative path it is written as. */
  targets: Record<string, string>;
}

type WorkerMessage =
  | { type: 'list'; headerEncrypted: boolean; headers: RarHeader[] }
  | { type: 'file'; name: string }
  | { type: 'done' }
  | { type: 'error'; reason?: string; message: string };

/**
 * Plain JavaScript, evaluated as CommonJS inside the worker. It never imports
 * from the bundle: only Node built-ins and the RAR module by absolute path.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const post = (message) => parentPort.postMessage(message);
const fail = (e) => post({
  type: 'error',
  reason: e && typeof e === 'object' && 'reason' in e ? String(e.reason) : undefined,
  message: e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
});
const normalize = (name) => String(name).replace(/\\\\/g, '/');
(async () => {
  try {
    const { createExtractorFromFile } = require(workerData.modulePath);
    if (workerData.mode === 'list') {
      const extractor = await createExtractorFromFile({
        filepath: workerData.archivePath,
        password: workerData.password,
      });
      const list = extractor.getFileList();
      const headers = [];
      for (const header of list.fileHeaders) {
        headers.push({
          name: header.name,
          directory: !!header.flags.directory,
          unpSize: header.unpSize,
          packSize: header.packSize,
          encrypted: !!header.flags.encrypted,
        });
      }
      post({ type: 'list', headerEncrypted: !!list.arcHeader.flags.headerEncrypted, headers });
      return;
    }
    const targets = workerData.targets;
    const extractor = await createExtractorFromFile({
      filepath: workerData.archivePath,
      targetPath: workerData.targetDir,
      password: workerData.password,
      filenameTransform: (name) => targets[normalize(name)] ?? name,
    });
    const list = extractor.getFileList();
    if (list.arcHeader.flags.headerEncrypted && !workerData.password) {
      post({ type: 'error', reason: 'ERAR_MISSING_PASSWORD', message: 'password required' });
      return;
    }
    // The generator drives the extraction; it must be walked to the end.
    const extracted = extractor.extract({ files: workerData.wanted });
    for (const file of extracted.files) {
      post({ type: 'file', name: file.fileHeader.name });
    }
    post({ type: 'done' });
  } catch (e) {
    fail(e);
  }
})();
`;

/** The RAR module's entry file, outside the asar so the worker can read it and its wasm. */
function rarModulePath(): string {
  const require = createRequire(import.meta.url);
  return unpackedBinaryPath(require.resolve('node-unrar-js'));
}

function runWorker(
  request: Omit<ListRequest, 'modulePath'> | Omit<ExtractRequest, 'modulePath'>,
  onMessage: (message: WorkerMessage) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
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
