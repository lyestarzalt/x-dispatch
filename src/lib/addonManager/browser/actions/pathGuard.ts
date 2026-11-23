import * as path from 'path';

/**
 * True when `targetPath` sits inside `basePath`. Every delete or rename of a
 * user's add-on folder checks this first, so a crafted `..` path cannot reach
 * outside the X-Plane folder.
 */
export function validatePathWithin(basePath: string, targetPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  return resolvedTarget.startsWith(resolvedBase + path.sep);
}
