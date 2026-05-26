import type { XDispatchModuleManifest } from './types';

export function parseGithubRepo(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

export function compareSemverLike(current: string, min: string): boolean {
  const norm = (v: string): number[] =>
    v
      .replace(/^v/i, '')
      .replace(/[^0-9.]/g, '.')
      .split('.')
      .filter(Boolean)
      .map((x) => Number.parseInt(x, 10))
      .filter((x) => Number.isFinite(x));
  const a = norm(current);
  const b = norm(min);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

export function isModuleManifest(value: unknown): value is XDispatchModuleManifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.version === 'string' &&
    (v.kind === 'core' || v.kind === 'bundled' || v.kind === 'external')
  );
}
