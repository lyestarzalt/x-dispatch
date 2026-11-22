import * as fs from 'fs';
import {
  type FaaObstacleDepartures,
  parseFaaObstacleDepartures,
} from '@/lib/parsers/nav/faaChartIndex';
import logger from '@/lib/utils/logger';
import { getFaaChartIndexPath } from '../paths';

let cached: { path: string; mtimeMs: number; index: FaaObstacleDepartures } | null = null;

/**
 * The obstacle departures from the FAA chart index the user placed in Custom Data, or null when
 * there is none. The file is read again only when it changes, so a new FAA cycle dropped in
 * takes effect on the next airport opened.
 */
export function loadFaaObstacleDepartures(xplanePath: string): FaaObstacleDepartures | null {
  const filePath = getFaaChartIndexPath(xplanePath);
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    cached = null;
    return null;
  }
  if (cached?.path === filePath && cached.mtimeMs === mtimeMs) return cached.index;
  try {
    const index = parseFaaObstacleDepartures(fs.readFileSync(filePath, 'utf-8'));
    cached = { path: filePath, mtimeMs, index };
    logger.data.info(`FAA chart index: obstacle departures at ${index.size} airports`);
    return index;
  } catch (err) {
    cached = null;
    logger.data.warn('Could not read the FAA chart index in Custom Data', err);
    return null;
  }
}
