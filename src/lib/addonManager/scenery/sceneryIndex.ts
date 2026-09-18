/**
 * Cached scenery classification.
 *
 * Classifying a pack walks its folder and reads DSF and apt.dat headers. That
 * is fine once and slow every time, so the result is stored against a
 * fingerprint of the folder and reused until the folder changes.
 *
 * The cache is strictly an optimisation: every read and write is best effort,
 * and an unavailable database simply means a full scan.
 */
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { SceneryClassification, SceneryPriority } from '../core/types';

export interface CachedScenery {
  fingerprint: string;
  priority: SceneryPriority;
  classification: SceneryClassification;
}

/**
 * Cheap signal that a pack changed: the folder's own timestamp plus the
 * timestamp of the data folder X-Plane actually reads.
 */
export async function fingerprintFolder(fullPath: string): Promise<string> {
  const parts: string[] = [];

  for (const candidate of [fullPath, path.join(fullPath, 'Earth nav data')]) {
    try {
      const stat = await fsp.stat(candidate);
      parts.push(`${Math.round(stat.mtimeMs)}:${stat.size}`);
    } catch {
      parts.push('-');
    }
  }

  return parts.join('|');
}

type SceneryIndexDb = {
  select: () => {
    from: (
      table: unknown
    ) => Promise<
      { fullPath: string; fingerprint: string; priority: number; classification: string }[]
    >;
  };
};

async function getIndexDb(): Promise<{
  db: SceneryIndexDb;
  table: unknown;
  save: () => void;
} | null> {
  try {
    const dbModule = await import('@/lib/db');
    if (!dbModule.isDbReady()) return null;
    return {
      db: dbModule.getDb() as unknown as SceneryIndexDb,
      table: dbModule.sceneryIndex,
      save: dbModule.saveDb,
    };
  } catch {
    return null;
  }
}

/**
 * Every cached classification, keyed by the folder it describes.
 */
export async function readSceneryIndex(): Promise<Map<string, CachedScenery>> {
  const cache = new Map<string, CachedScenery>();
  const handle = await getIndexDb();
  if (!handle) return cache;

  try {
    const rows = await handle.db.select().from(handle.table);
    for (const row of rows) {
      cache.set(row.fullPath, {
        fingerprint: row.fingerprint,
        priority: row.priority as SceneryPriority,
        classification: JSON.parse(row.classification) as SceneryClassification,
      });
    }
  } catch {
    cache.clear();
  }

  return cache;
}

export interface SceneryIndexRowInput {
  fullPath: string;
  sceneryPath: string;
  fingerprint: string;
  priority: SceneryPriority;
  classification: SceneryClassification;
}

/**
 * Replace the cache with exactly the packs that are installed now, so folders
 * the user deleted do not linger.
 */
export async function writeSceneryIndex(rows: SceneryIndexRowInput[]): Promise<void> {
  const handle = await getIndexDb();
  if (!handle) return;

  try {
    const dbModule = await import('@/lib/db');
    const db = dbModule.getDb();
    const scannedAt = Date.now();

    await db.delete(dbModule.sceneryIndex);
    if (rows.length > 0) {
      await db.insert(dbModule.sceneryIndex).values(
        rows.map((row) => ({
          fullPath: row.fullPath,
          sceneryPath: row.sceneryPath,
          fingerprint: row.fingerprint,
          priority: row.priority,
          classification: JSON.stringify(row.classification),
          scannedAt,
        }))
      );
    }
    handle.save();
  } catch {
    // A cache that cannot be written just means the next open rescans
  }
}
