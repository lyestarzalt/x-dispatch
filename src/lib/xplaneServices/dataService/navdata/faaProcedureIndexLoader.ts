import * as fs from 'fs';
import {
  type FaaProcedureIndex,
  parseFaaProcedureIndex,
} from '@/lib/parsers/nav/faaProcedureIndex';
import logger from '@/lib/utils/logger';
import { getFaaProcedureIndexPath } from '../paths';

let cached: { path: string; mtimeMs: number; index: FaaProcedureIndex } | null = null;

/**
 * The FAA procedure index the user placed in Custom Data, or null when there is none. It is
 * read again only when the file changes, so a new FAA cycle dropped in takes effect on the next
 * airport opened.
 */
export function loadFaaProcedureIndex(xplanePath: string): FaaProcedureIndex | null {
  const filePath = getFaaProcedureIndexPath(xplanePath);
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    cached = null;
    return null;
  }
  if (cached?.path === filePath && cached.mtimeMs === mtimeMs) return cached.index;
  try {
    const index = parseFaaProcedureIndex(fs.readFileSync(filePath, 'utf-8'));
    cached = { path: filePath, mtimeMs, index };
    logger.data.info(`FAA procedure index: approaches at ${index.size} airports`);
    return index;
  } catch (err) {
    cached = null;
    logger.data.warn('Could not read the FAA procedure index in Custom Data', err);
    return null;
  }
}
