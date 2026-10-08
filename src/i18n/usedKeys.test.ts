import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';

const SRC = join(__dirname, '..');
/** `t('a.b')`, `t("a.b")` and `i18n.t('a.b')` with a literal key; template keys can't be checked. */
const CALL = /\bt\(\s*(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'locales' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function has(key: string): boolean {
  const parts = key.split('.');
  const leaf = parts.pop()!;
  let node: unknown = en;
  for (const part of parts) node = (node as Record<string, unknown> | undefined)?.[part];
  const obj = node as Record<string, unknown> | undefined;
  // A plural key is stored as key_one / key_other.
  return !!obj && (leaf in obj || `${leaf}_one` in obj || `${leaf}_other` in obj);
}

describe('translation keys used in code', () => {
  it('all exist in en.json, so no screen shows a raw key', () => {
    const missing: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(CALL)) {
        const key = match[2]!;
        if (!has(key)) missing.push(`${key}  (${file.slice(SRC.length + 1)})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
