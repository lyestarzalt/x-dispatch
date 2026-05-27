import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { extractArchive } from '@/lib/addonManager/installer/extraction';
import logger from '@/lib/utils/logger';

const NESTED_ARCHIVE_EXT = new Set(['.7z', '.zip']);

/**
 * eAIP "ZIP complet" often ships regional packages as nested .7z/.zip files.
 * Extract them in-place so VAC/AIP PDFs become visible to the indexer.
 */
export async function extractNestedArchives(
  root: string,
  onArchive?: (name: string) => void
): Promise<{ extracted: number; failed: number }> {
  let extracted = 0;
  let failed = 0;
  const queue: string[] = [root];

  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!NESTED_ARCHIVE_EXT.has(ext)) continue;

      const archivePath = path.join(dir, ent.name);
      const targetDir = path.join(dir, path.basename(ent.name, ext));
      if (fs.existsSync(targetDir)) {
        queue.push(targetDir);
        continue;
      }

      onArchive?.(ent.name);
      const result = await extractArchive({ archivePath, targetDir });
      if (!result.ok) {
        failed++;
        logger.main.warn(`Nested archive extraction failed: ${archivePath}`, result.error);
        continue;
      }

      extracted++;
      queue.push(targetDir);
    }

    for (const ent of entries) {
      if (ent.isDirectory()) {
        queue.push(path.join(dir, ent.name));
      }
    }
  }

  return { extracted, failed };
}
