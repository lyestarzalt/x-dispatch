/**
 * Which node_modules folders a packaged app needs for the modules Vite leaves
 * external. A package alone is not enough: node-7z needs `debug` and five lodash
 * helpers, and a missing one only fails at runtime, on the user's machine.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageManifest {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function readManifest(dir: string): PackageManifest | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as PackageManifest;
  } catch {
    return null;
  }
}

/**
 * Where `name` resolves from a package at `fromDir`: its own nested node_modules
 * first, then each parent's, the way Node does it.
 */
function resolvePackageDir(rootNodeModules: string, fromDir: string, name: string): string | null {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir || !dir.startsWith(path.dirname(rootNodeModules))) break;
    dir = parent;
  }
  const top = path.join(rootNodeModules, name);
  return fs.existsSync(path.join(top, 'package.json')) ? top : null;
}

/**
 * Every package folder, relative to `rootNodeModules`, that `roots` and their
 * runtime dependencies live in. Missing optional dependencies are skipped;
 * a missing required one throws, so the build fails instead of the app.
 *
 * A package nested under another listed package is left out: it ships inside
 * its parent's folder, which is copied whole. Listed as well, the forge hook
 * copied it twice at the same time, and `fs.cp` replaces files it finds, so
 * one copy's chmod found a file the other had just removed (the mac build of
 * 2.13.0 failed on `path-scurry/node_modules/lru-cache`).
 */
export function collectPackageDependencies(rootNodeModules: string, roots: string[]): string[] {
  const seen = new Set<string>();
  const queue: string[] = [];

  for (const name of roots) {
    const dir = resolvePackageDir(rootNodeModules, path.dirname(rootNodeModules), name);
    if (!dir) throw new Error(`Package to bundle not installed: ${name}`);
    queue.push(dir);
  }

  while (queue.length) {
    const dir = queue.shift();
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    const manifest = readManifest(dir);
    if (!manifest) continue;
    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      const depDir = resolvePackageDir(rootNodeModules, dir, dep);
      if (!depDir) throw new Error(`Dependency of ${path.basename(dir)} not installed: ${dep}`);
      queue.push(depDir);
    }
    for (const dep of Object.keys(manifest.optionalDependencies ?? {})) {
      const depDir = resolvePackageDir(rootNodeModules, dir, dep);
      if (depDir) queue.push(depDir);
    }
  }

  const dirs = [...seen];
  const nestedMarker = `${path.sep}node_modules${path.sep}`;
  const insideAnother = (dir: string) =>
    dirs.some((other) => other !== dir && dir.startsWith(other + nestedMarker));
  return dirs
    .filter((dir) => !insideAnother(dir))
    .map((dir) => path.relative(rootNodeModules, dir))
    .sort();
}
