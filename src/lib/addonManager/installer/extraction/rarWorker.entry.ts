/**
 * The RAR worker thread. Built as its own bundle (`rarWorker.js`, a Forge Vite
 * build entry beside `main.js`) and started by `rarWorker.ts`, which is the
 * only module that talks to it. It loads the RAR engine from the absolute
 * path the main process resolved, outside the asar, and answers over
 * `parentPort` with the messages `rarWorker.ts` declares.
 */
import type { createExtractorFromFile } from 'node-unrar-js';
import { parentPort, workerData } from 'worker_threads';
import type { ExtractRequest, ListRequest, RarHeader, WorkerMessage } from './rarWorkerProtocol';

type RarModule = { createExtractorFromFile: typeof createExtractorFromFile };

const request = workerData as ListRequest | ExtractRequest;

function post(message: WorkerMessage): void {
  parentPort?.postMessage(message);
}

function fail(e: unknown): void {
  const error = e && typeof e === 'object' ? (e as { reason?: unknown; message?: unknown }) : null;
  post({
    type: 'error',
    reason: error && 'reason' in error ? String(error.reason) : undefined,
    message: error && 'message' in error ? String(error.message) : String(e),
  });
}

const normalize = (name: string): string => name.replace(/\\/g, '/');

async function run(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createExtractorFromFile } = require(request.modulePath) as RarModule;
  if (request.mode === 'list') {
    const extractor = await createExtractorFromFile({
      filepath: request.archivePath,
      password: request.password,
    });
    const list = extractor.getFileList();
    const headers: RarHeader[] = [];
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
  const targets = request.targets;
  const extractor = await createExtractorFromFile({
    filepath: request.archivePath,
    targetPath: request.targetDir,
    password: request.password,
    filenameTransform: (name) => targets[normalize(name)] ?? name,
  });
  const list = extractor.getFileList();
  if (list.arcHeader.flags.headerEncrypted && !request.password) {
    post({ type: 'error', reason: 'ERAR_MISSING_PASSWORD', message: 'password required' });
    return;
  }
  // The generator drives the extraction; it must be walked to the end.
  const extracted = extractor.extract({ files: request.wanted });
  for (const file of extracted.files) {
    post({ type: 'file', name: file.fileHeader.name });
  }
  post({ type: 'done' });
}

run().catch(fail);
