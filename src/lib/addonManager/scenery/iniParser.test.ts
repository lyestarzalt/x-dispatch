import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SceneryEntry } from '../core/types';
import { parseSceneryPacksIni, writeSceneryPacksIni } from './iniParser';

let root: string;
let customScenery: string;
let iniPath: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-ini-'));
  customScenery = path.join(root, 'Custom Scenery');
  fs.mkdirSync(customScenery);
  iniPath = path.join(customScenery, 'scenery_packs.ini');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const INI = [
  'I',
  '1000 Version',
  'SCENERY',
  '',
  'SCENERY_PACK Custom Scenery/Alpha/',
  'SCENERY_PACK_DISABLED Custom Scenery/Bravo/',
  'SCENERY_PACK_DISABLED *GLOBAL_AIRPORTS*',
  'SCENERY_PACK_DISABLED /mnt/drive/Charlie/',
  '',
].join('\n');

describe('scenery_packs.ini round trip', () => {
  it('keeps disabled packs disabled through parse and write', () => {
    fs.writeFileSync(iniPath, INI);
    const parsed = parseSceneryPacksIni(iniPath, customScenery);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.map((e) => [e.folderName, e.enabled])).toEqual([
      ['Alpha', true],
      ['Bravo', false],
      ['*GLOBAL_AIRPORTS*', false],
      ['Charlie', false],
    ]);

    const entries: SceneryEntry[] = parsed.value.map((e, i) => ({
      folderName: e.folderName,
      fullPath: e.fullPath,
      enabled: e.enabled,
      priority: 0,
      classification: {} as SceneryEntry['classification'],
      originalIndex: i,
      isGlobalAirports: e.isGlobalAirports,
      sceneryPath: e.sceneryPath,
    }));
    expect(writeSceneryPacksIni(iniPath, entries).ok).toBe(true);

    const written = fs.readFileSync(iniPath, 'utf-8').split('\n');
    expect(written).toContain('SCENERY_PACK Custom Scenery/Alpha/');
    expect(written).toContain('SCENERY_PACK_DISABLED Custom Scenery/Bravo/');
    expect(written).toContain('SCENERY_PACK_DISABLED *GLOBAL_AIRPORTS*');
    expect(written).toContain('SCENERY_PACK_DISABLED /mnt/drive/Charlie/');
  });

  it("writes X-Plane's own header, SCENERY line included", () => {
    // X-Plane 12.4.3 rebuilds a file whose header lacks the SCENERY line and
    // re-enables every pack while doing so.
    expect(writeSceneryPacksIni(iniPath, []).ok).toBe(true);
    expect(fs.readFileSync(iniPath, 'utf-8')).toBe('I\n1000 Version\nSCENERY\n\n');
  });

  it('reads Windows line endings', () => {
    fs.writeFileSync(iniPath, INI.replace(/\n/g, '\r\n'));
    const parsed = parseSceneryPacksIni(iniPath, customScenery);
    expect(parsed.ok && parsed.value.find((e) => e.folderName === 'Bravo')?.enabled).toBe(false);
  });
});
