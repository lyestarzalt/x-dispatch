import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Vite leaves some modules out of the main bundle; the packaged app can only load
 * them if the forge hook copies them into its node_modules. 2.9.0 shipped with
 * node-unrar-js bundled as its browser build and node-7z copied without its
 * dependencies, so every drop of a .rar or .7z failed. This keeps the two lists
 * in step.
 */
function quotedNames(source: string, start: string): string[] {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Marker not found: ${start}`);
  const block = source.slice(from, source.indexOf('];', from));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

describe('externals shipped with the packaged app', () => {
  const root = path.resolve(__dirname, '../../..');
  const vite = fs.readFileSync(path.join(root, 'vite.base.config.mts'), 'utf8');
  const forge = fs.readFileSync(path.join(root, 'forge.config.ts'), 'utf8');

  it('copies every external module into the package', () => {
    const external = quotedNames(vite, 'export const external = [');
    const copied = quotedNames(forge, 'const requiredPackages = [');
    for (const name of external) {
      expect(copied, `${name} is external but not copied by forge.config.ts`).toContain(name);
    }
  });

  it('keeps the archive engines external', () => {
    const external = quotedNames(vite, 'export const external = [');
    expect(external).toEqual(expect.arrayContaining(['7zip-bin', 'node-7z', 'node-unrar-js']));
  });
});
