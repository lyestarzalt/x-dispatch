/** What the main process sends the RAR worker and what the worker answers. */

/** One entry of a RAR listing, as the worker reports it. */
export interface RarHeader {
  name: string;
  directory: boolean;
  unpSize: number;
  packSize: number;
  encrypted: boolean;
}

export interface ListRequest {
  mode: 'list';
  /** The RAR module's entry file, resolved by the main process. */
  modulePath: string;
  archivePath: string;
  password?: string;
}

export interface ExtractRequest {
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

export type WorkerMessage =
  | { type: 'list'; headerEncrypted: boolean; headers: RarHeader[] }
  | { type: 'file'; name: string }
  | { type: 'done' }
  | { type: 'error'; reason?: string; message: string };
