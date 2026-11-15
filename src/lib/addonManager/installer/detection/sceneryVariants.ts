/**
 * Option folders inside a scenery package: "with trees" and "without", a
 * seasonal variant, a different runway layout. Each is a set of navigation files
 * that replaces the matching ones in the base pack. The user picks one at install
 * time, or keeps the package as shipped.
 */
import { normalizeEntryPath, shouldIgnore } from '../extraction/options';
import type { ArchiveEntry } from '../types';

export interface VariantFile {
  /** Archive entry path of the replacement file. */
  source: string;
  /** Where it lands, relative to the pack folder; always under `Earth nav data`. */
  destination: string;
  size: number;
}

export interface SceneryVariant {
  /** The option folder's archive path, with a trailing slash. */
  root: string;
  /** The option folder's own name. */
  name: string;
  files: VariantFile[];
}

/** Folder names that mean "pick one of these", in English and Chinese. */
const SELECTABLE_WORDS = [
  'option',
  'optional',
  'selectable',
  'selection',
  'variant',
  'alternative',
  'preset',
  'config',
  'replacement',
  'choice',
  'extras',
  '可选',
  '选择',
  '配置',
  '替换',
  '备选',
  '备用',
  '预设',
  '版本',
];

const NAV_DATA_DIR = 'earth nav data';

function isNavFile(entryPath: string): boolean {
  const lower = entryPath.toLowerCase();
  return lower.endsWith('/apt.dat') || lower === 'apt.dat' || lower.endsWith('.dsf');
}

function isSelectableName(name: string): boolean {
  const lower = name.toLowerCase();
  return SELECTABLE_WORDS.some((word) => lower.includes(word));
}

/** `Earth nav data/...` from an archive path, whatever sits in front of it. */
function navDataRelative(entryPath: string): string | null {
  const parts = entryPath.split('/');
  const index = parts.findIndex((part) => part.toLowerCase() === NAV_DATA_DIR);
  if (index === -1) return null;
  return parts.slice(index).join('/');
}

/**
 * Variants of the scenery whose files live under `baseRoot` ('' for the whole
 * archive). A candidate is any folder named with a selectable word, or a child
 * of such a folder, that holds navigation files outside the base's own
 * `Earth nav data`. An option identical to the base is not offered.
 */
export function detectSceneryVariants(entries: ArchiveEntry[], baseRoot: string): SceneryVariant[] {
  const files = entries.filter(
    (entry) =>
      !entry.isDirectory &&
      !entry.path.endsWith('/') &&
      !shouldIgnore(entry.path) &&
      normalizeEntryPath(entry.path).startsWith(baseRoot)
  );
  const baseNavDir = `${baseRoot}Earth nav data/`.toLowerCase();

  // Base files by their Earth nav data path, for matching and for the identity check.
  const baseFiles = new Map<string, ArchiveEntry>();
  for (const entry of files) {
    const normalized = normalizeEntryPath(entry.path);
    if (!normalized.toLowerCase().startsWith(baseNavDir)) continue;
    baseFiles.set(normalized.slice(baseRoot.length), entry);
  }

  // Candidate option folders: selectable folders, and their direct children.
  const candidates = new Set<string>();
  for (const entry of files) {
    const normalized = normalizeEntryPath(entry.path);
    if (normalized.toLowerCase().startsWith(baseNavDir)) continue;
    if (!isNavFile(normalized)) continue;
    const relative = normalized.slice(baseRoot.length);
    const parts = relative.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isSelectableName(parts[i]!)) continue;
      const selectable = `${baseRoot}${parts.slice(0, i + 1).join('/')}/`;
      const child =
        i + 1 < parts.length - 1 ? `${baseRoot}${parts.slice(0, i + 2).join('/')}/` : null;
      // A folder of options holds one per child; a lone option is the folder itself.
      if (child && parts[i + 1]!.toLowerCase() !== NAV_DATA_DIR) candidates.add(child);
      else candidates.add(selectable);
      break;
    }
  }

  const variants: SceneryVariant[] = [];
  for (const root of [...candidates].sort()) {
    const inside = files.filter((entry) => normalizeEntryPath(entry.path).startsWith(root));
    const mapped: VariantFile[] = [];
    for (const entry of inside) {
      const normalized = normalizeEntryPath(entry.path);
      if (!isNavFile(normalized)) continue;
      const within = normalized.slice(root.length);
      let destination = navDataRelative(within);
      if (!destination) {
        // A bare tile or apt.dat: it replaces the base file of the same name.
        const name = within.split('/').pop()!;
        const match = [...baseFiles.keys()].find((key) => key.split('/').pop() === name);
        if (!match) continue;
        destination = match;
      }
      mapped.push({ source: entry.path, destination, size: entry.uncompressedSize });
    }
    if (mapped.length === 0) continue;
    const sameAsBase = mapped.every((file) => {
      const base = baseFiles.get(file.destination);
      return (
        base !== undefined &&
        base.uncompressedSize === file.size &&
        (base.crc32 === undefined ||
          files.find((e) => e.path === file.source)?.crc32 === base.crc32)
      );
    });
    if (sameAsBase) continue;
    const name = root.slice(0, -1).split('/').pop()!;
    variants.push({ root, name, files: mapped });
  }
  return variants;
}
