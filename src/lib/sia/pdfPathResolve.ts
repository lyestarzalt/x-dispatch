import * as fs from 'fs';
import * as path from 'path';

/** Walk extract tree (bounded depth) to find a PDF by basename. */
export function findPdfByBasename(root: string, basename: string, maxDepth = 12): string | null {
  if (!fs.existsSync(root) || maxDepth < 0) return null;
  const target = basename.toLowerCase();

  function walk(dir: string, depth: number): string | null {
    if (depth > maxDepth) return null;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && ent.name.toLowerCase() === target) return full;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const found = walk(path.join(dir, ent.name), depth + 1);
      if (found) return found;
    }
    return null;
  }

  return walk(root, 0);
}

/** Suffix after eAIP markers for relocatable installs (absolute path → relative). */
export function extractEaipRelativeSuffix(pdfPath: string): string | null {
  const norm = pdfPath.replace(/\\/g, '/');
  const markers = ['/html/eAIP/', '/eAIP/', '/ATLAS-VAC/', '/Atlas-VAC/', '/AD/'];
  const upper = norm.toUpperCase();
  for (const marker of markers) {
    const idx = upper.indexOf(marker.toUpperCase());
    if (idx >= 0) return norm.slice(idx + 1);
  }
  return null;
}
