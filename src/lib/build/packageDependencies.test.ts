import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectPackageDependencies } from './packageDependencies';

let root: string;
let nodeModules: string;

function pkg(dir: string, manifest: Record<string, unknown>) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-deps-'));
  nodeModules = path.join(root, 'node_modules');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('collectPackageDependencies', () => {
  it('follows runtime dependencies, hoisted and nested', () => {
    pkg(path.join(nodeModules, 'engine'), {
      dependencies: { debug: '*', helper: '*' },
      devDependencies: { vitest: '*' },
    });
    pkg(path.join(nodeModules, 'debug'), { dependencies: { ms: '*' } });
    pkg(path.join(nodeModules, 'ms'), {});
    pkg(path.join(nodeModules, 'engine', 'node_modules', 'helper'), {});
    pkg(path.join(nodeModules, 'vitest'), {});

    expect(collectPackageDependencies(nodeModules, ['engine'])).toEqual([
      'debug',
      'engine',
      path.join('engine', 'node_modules', 'helper'),
      'ms',
    ]);
  });

  it('skips a missing optional dependency and fails on a missing required one', () => {
    pkg(path.join(nodeModules, 'a'), { optionalDependencies: { fsevents: '*' } });
    expect(collectPackageDependencies(nodeModules, ['a'])).toEqual(['a']);

    pkg(path.join(nodeModules, 'b'), { dependencies: { gone: '*' } });
    expect(() => collectPackageDependencies(nodeModules, ['b'])).toThrow(/gone/);
  });

  it('covers what the packaged app loads from node_modules', () => {
    const real = path.resolve(__dirname, '../../../node_modules');
    const copied = collectPackageDependencies(real, ['node-7z', 'node-unrar-js']);
    for (const needed of ['node-7z', 'debug', 'ms', 'lodash.defaultsdeep', 'node-unrar-js']) {
      expect(copied).toContain(needed);
    }
  });
});
