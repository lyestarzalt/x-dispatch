import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toggleAircraft, togglePlugin } from './toggle';

let xplane: string;

function tree(root: string, files: Record<string, string>): string {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function names(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, rel: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), childRel);
      else out.push(childRel);
    }
  };
  walk(dir, '');
  return out.sort();
}

beforeEach(() => {
  xplane = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-toggle-'));
});

afterEach(() => {
  fs.rmSync(xplane, { recursive: true, force: true });
});

describe('togglePlugin', () => {
  it('disables every binary of a plugin and enables them again', () => {
    const plugin = tree(path.join(xplane, 'Resources', 'plugins', 'Traffic'), {
      'win_x64/Traffic.xpl': 'w',
      'mac_x64/Traffic.xpl': 'm',
      'lin_x64/Traffic.xpl': 'l',
    });
    expect(togglePlugin(xplane, 'Traffic')).toEqual({ ok: true, value: false });
    expect(names(plugin)).toEqual([
      'lin_x64/Traffic.xfmp',
      'mac_x64/Traffic.xfmp',
      'win_x64/Traffic.xfmp',
    ]);
    expect(togglePlugin(xplane, 'Traffic')).toEqual({ ok: true, value: true });
    expect(names(plugin)).toEqual([
      'lin_x64/Traffic.xpl',
      'mac_x64/Traffic.xpl',
      'win_x64/Traffic.xpl',
    ]);
  });

  it('puts the renamed files back when one rename fails, so the plugin is never half off', () => {
    const plugin = tree(path.join(xplane, 'Resources', 'plugins', 'Traffic'), {
      'lin_x64/Traffic.xpl': 'l',
      'mac_x64/Traffic.xpl': 'm',
      'win_x64/Traffic.xpl': 'w',
    });
    // A folder sitting where one renamed file must land makes that rename fail.
    fs.mkdirSync(path.join(plugin, 'mac_x64', 'Traffic.xfmp'));
    const result = togglePlugin(xplane, 'Traffic');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOGGLE_FAILED');
    expect(names(plugin).filter((name) => name.endsWith('.xpl'))).toEqual([
      'lin_x64/Traffic.xpl',
      'mac_x64/Traffic.xpl',
      'win_x64/Traffic.xpl',
    ]);
  });
});

describe('toggleAircraft', () => {
  it('renames only the top-level .acf files and rolls back on failure', () => {
    const aircraft = tree(path.join(xplane, 'Aircraft', 'Bird'), {
      'bird.acf': 'a',
      'bird_cargo.acf': 'b',
      'liveries/x/bird.acf': 'not touched',
    });
    expect(toggleAircraft(xplane, 'Bird')).toEqual({ ok: true, value: false });
    expect(names(aircraft)).toEqual(['bird.xfma', 'bird_cargo.xfma', 'liveries/x/bird.acf']);

    fs.mkdirSync(path.join(aircraft, 'bird_cargo.acf'));
    expect(toggleAircraft(xplane, 'Bird').ok).toBe(false);
    expect(names(aircraft).filter((name) => !name.startsWith('bird_cargo.acf'))).toEqual([
      'bird.xfma',
      'bird_cargo.xfma',
      'liveries/x/bird.acf',
    ]);
  });
});
