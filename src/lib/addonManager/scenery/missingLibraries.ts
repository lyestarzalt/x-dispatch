/**
 * Which libraries a scenery package needs and does not have. Each tile's DSF
 * names the objects, polygons, roads and terrain it places as virtual paths;
 * X-Plane resolves those against the package's own files and the EXPORT lines
 * of every installed library. A path nothing resolves shows up in the sim as
 * missing objects, so it is reported here by the library it belongs to.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DsfDefinitions } from '../core/dsfParser';
import { readDsfDefinitions } from '../core/dsfParser';
import { findLibraryTxt, readLibraryExports } from './libraryTxt';

/** Folders under the X-Plane root whose packages may export libraries. */
const LIBRARY_ROOTS = [
  'Custom Scenery',
  path.join('Resources', 'default scenery'),
  'Global Scenery',
];

/** A library.txt's exports, remembered until the file changes. */
const exportsCache = new Map<string, { key: string; exports: string[] }>();

async function cachedExports(filePath: string): Promise<string[]> {
  let key: string;
  try {
    const stat = await fs.promises.stat(filePath);
    key = `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return [];
  }
  const cached = exportsCache.get(filePath);
  if (cached && cached.key === key) return cached.exports;
  const exports = await readLibraryExports(filePath);
  exportsCache.set(filePath, { key, exports });
  return exports;
}

/** Every virtual path any installed library exports, lower-cased for lookup. */
export type LibraryIndex = Set<string>;

/**
 * Folders a package keeps its own files in. An unresolved path starting with one
 * of these is a broken package, not a library to install.
 */
const LOCAL_FOLDERS = new Set([
  'objects',
  'facades',
  'vegetation',
  'roads',
  'textures',
  'terrain',
  'forests',
  'lines',
  'beaches',
  'orthophotos',
  'earth nav data',
  'plugins',
  'documentation',
  'doc',
  'docs',
]);

/**
 * @param packageDirs scenery packs that live outside Custom Scenery (external
 * drives, shortcuts) and may still export libraries
 */
export async function buildLibraryIndex(
  xplanePath: string,
  packageDirs: string[] = []
): Promise<LibraryIndex> {
  const index: LibraryIndex = new Set();
  const addPackage = async (dir: string) => {
    const file = await findLibraryTxt(dir);
    if (!file) return;
    for (const vpath of await cachedExports(file)) index.add(vpath.toLowerCase());
  };
  for (const dir of packageDirs) await addPackage(dir);
  for (const root of LIBRARY_ROOTS) {
    const dir = path.join(xplanePath, root);
    let packages: string[];
    try {
      packages = await fs.promises.readdir(dir);
    } catch {
      continue;
    }
    for (const pkg of packages) await addPackage(path.join(dir, pkg));
  }
  return index;
}

/**
 * The library a virtual path belongs to. Libraries publish under their own top
 * folder (`opensceneryx/...`, `SAM_Library/...`); X-Plane's shared `lib/` tree
 * is one level deeper (`lib/airport`, `lib/g10`).
 */
export function libraryNameOf(vpath: string): string {
  const parts = vpath.split('/').filter(Boolean);
  const first = parts[0] ?? vpath;
  if (first.toLowerCase() === 'lib' && parts[1]) return `${first}/${parts[1]}`;
  return first;
}

export interface MissingLibrariesInput {
  /** Tiles to read; a handful is enough, every tile of a package asks for the same libraries. */
  dsfPaths: string[];
  /** Does the package itself ship this file (relative to its root). */
  hasOwnFile: (ref: string) => boolean | Promise<boolean>;
  index: LibraryIndex;
  /** Exports of the package's own library.txt, if it has one. */
  ownExports?: string[];
}

/**
 * Is an unresolved path something a library would provide. X-Plane's own `lib/`
 * tree is never a download, and a bare file or a package folder name is a
 * broken package rather than a missing library.
 */
export function isLibraryReference(ref: string): boolean {
  // `::FLATTEN::.pol` and friends are X-Plane's built-in pseudo-definitions
  if (ref.startsWith('::')) return false;
  const parts = ref.split('/').filter(Boolean);
  const first = parts[0]?.toLowerCase() ?? '';
  if (parts.length < 2 || first === 'lib') return false;
  return !LOCAL_FOLDERS.has(first);
}

/** Every reference across the tables that nothing resolves. */
export async function unresolvedReferences(
  definitions: DsfDefinitions,
  input: Omit<MissingLibrariesInput, 'dsfPaths'>
): Promise<string[]> {
  const own = new Set((input.ownExports ?? []).map((v) => v.toLowerCase()));
  const refs = [
    ...definitions.objects,
    ...definitions.polygons,
    ...definitions.networks,
    ...definitions.terrain,
  ];
  const missing: string[] = [];
  for (const ref of refs) {
    if (!ref || ref.includes('..')) continue;
    const lower = ref.toLowerCase();
    if (input.index.has(lower) || own.has(lower)) continue;
    if (await input.hasOwnFile(ref)) continue;
    missing.push(ref);
  }
  return missing;
}

/** The libraries a package needs and the sim does not have, sorted by name. */
export async function missingLibrariesFor(input: MissingLibrariesInput): Promise<string[]> {
  const libraries = new Set<string>();
  for (const dsfPath of input.dsfPaths) {
    const definitions = await readDsfDefinitions(dsfPath);
    if (!definitions) continue;
    for (const ref of await unresolvedReferences(definitions, input)) {
      if (isLibraryReference(ref)) libraries.add(libraryNameOf(ref));
    }
  }
  return [...libraries].sort((a, b) => a.localeCompare(b));
}

/** A package's files, for `hasOwnFile`: the reference is a path under its root. */
export function ownFileChecker(packagePath: string): (ref: string) => boolean {
  return (ref) => fs.existsSync(path.join(packagePath, ...ref.split('/')));
}
