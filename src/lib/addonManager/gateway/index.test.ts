import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GATEWAY_MARKER_FILE,
  decodeGatewayPackage,
  gatewayFolderName,
  installGatewayScenery,
  readGatewayMarker,
  removeGatewayScenery,
} from './index';

vi.mock('@/lib/utils/logger', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: { addon: scope, security: scope, main: scope, data: scope } };
});

let dir: string;
let xplane: string;

function tree(root: string, files: Record<string, string>): string {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

/** A Gateway-style scenery record whose zip holds `files`. */
async function sceneryRecord(files: Record<string, string>): Promise<string> {
  const { path7za } = await import('7zip-bin');
  const src = tree(fs.mkdtempSync(path.join(dir, 'src-')), files);
  const out = path.join(dir, `pack-${Math.random()}.zip`);
  execFileSync(path7za, ['a', '-y', out, '.'], { cwd: src, stdio: 'ignore' });
  const blob = fs.readFileSync(out).toString('base64');
  return JSON.stringify({ scenery: { sceneryId: 42, icao: 'EGLL', masterZipBlob: blob } });
}

const APT = 'I\n1000 Version\n1 83 0 0 EGLL Heathrow\n99\n';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-gateway-'));
  xplane = path.join(dir, 'X-Plane 12');
  fs.mkdirSync(path.join(xplane, 'Custom Scenery'), { recursive: true });
  fs.writeFileSync(
    path.join(xplane, 'Custom Scenery', 'scenery_packs.ini'),
    'I\n1000 Version\nSCENERY\n\n'
  );
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('decodeGatewayPackage', () => {
  it('refuses a record without a zip', () => {
    expect(decodeGatewayPackage('{"scenery":{}}')).toMatchObject({
      ok: false,
      error: { code: 'BAD_PACKAGE' },
    });
    expect(decodeGatewayPackage('nope')).toMatchObject({
      ok: false,
      error: { code: 'BAD_PACKAGE' },
    });
    const notZip = JSON.stringify({
      scenery: { masterZipBlob: Buffer.from('hello').toString('base64') },
    });
    expect(decodeGatewayPackage(notZip)).toMatchObject({
      ok: false,
      error: { code: 'BAD_PACKAGE' },
    });
  });
});

describe('installGatewayScenery', () => {
  it('installs the pack into a folder of our own name and writes the marker', async () => {
    const record = await sceneryRecord({ 'EGLL/Earth nav data/apt.dat': APT });
    const result = await installGatewayScenery(
      { xplanePath: xplane, fetchScenery: async () => ({ data: record, error: null }) },
      { icao: 'egll', sceneryId: 42 }
    );
    expect(result).toEqual({ ok: true, value: { folderName: 'Gateway_EGLL' } });
    const folder = path.join(xplane, 'Custom Scenery', gatewayFolderName('EGLL'));
    expect(fs.readFileSync(path.join(folder, 'Earth nav data', 'apt.dat'), 'utf8')).toBe(APT);
    expect(await readGatewayMarker(xplane, 'EGLL')).toMatchObject({ sceneryId: 42, icao: 'EGLL' });
    expect(fs.existsSync(path.join(folder, GATEWAY_MARKER_FILE))).toBe(true);
  });

  it('stops when another pack already covers the airport, unless forced', async () => {
    tree(path.join(xplane, 'Custom Scenery', 'Heathrow by someone', 'Earth nav data'), {
      'apt.dat': APT,
    });
    fs.writeFileSync(
      path.join(xplane, 'Custom Scenery', 'scenery_packs.ini'),
      'I\n1000 Version\nSCENERY\n\nSCENERY_PACK Custom Scenery/Heathrow by someone/\n'
    );
    const record = await sceneryRecord({ 'EGLL/Earth nav data/apt.dat': APT });
    const deps = { xplanePath: xplane, fetchScenery: async () => ({ data: record, error: null }) };
    expect(await installGatewayScenery(deps, { icao: 'EGLL', sceneryId: 42 })).toEqual({
      ok: false,
      error: { code: 'CONFLICT', pack: 'Heathrow by someone' },
    });
    const forced = await installGatewayScenery(deps, { icao: 'EGLL', sceneryId: 42, force: true });
    expect(forced.ok).toBe(true);
  });

  it('replaces its own earlier pack and reports a failed download', async () => {
    const first = await sceneryRecord({
      'EGLL/Earth nav data/apt.dat': APT,
      'EGLL/old.txt': 'old',
    });
    const deps = { xplanePath: xplane, fetchScenery: async () => ({ data: first, error: null }) };
    expect((await installGatewayScenery(deps, { icao: 'EGLL', sceneryId: 41 })).ok).toBe(true);
    const second = await sceneryRecord({ 'EGLL/Earth nav data/apt.dat': APT });
    const again = await installGatewayScenery(
      { xplanePath: xplane, fetchScenery: async () => ({ data: second, error: null }) },
      { icao: 'EGLL', sceneryId: 42 }
    );
    expect(again.ok).toBe(true);
    const folder = path.join(xplane, 'Custom Scenery', 'Gateway_EGLL');
    expect(fs.existsSync(path.join(folder, 'old.txt'))).toBe(false);
    expect((await readGatewayMarker(xplane, 'EGLL'))?.sceneryId).toBe(42);

    const failed = await installGatewayScenery(
      {
        xplanePath: xplane,
        fetchScenery: async () => ({ data: null, error: 'Timeout after 1ms' }),
      },
      { icao: 'LFPG', sceneryId: 7 }
    );
    expect(failed).toEqual({
      ok: false,
      error: { code: 'DOWNLOAD_FAILED', reason: 'Timeout after 1ms' },
    });
  });
});

describe('removeGatewayScenery', () => {
  it('removes the folder we installed and refuses one we did not', async () => {
    const record = await sceneryRecord({ 'EGLL/Earth nav data/apt.dat': APT });
    await installGatewayScenery(
      { xplanePath: xplane, fetchScenery: async () => ({ data: record, error: null }) },
      { icao: 'EGLL', sceneryId: 42 }
    );
    expect(await removeGatewayScenery(xplane, 'EGLL')).toEqual({ ok: true, value: undefined });
    expect(fs.existsSync(path.join(xplane, 'Custom Scenery', 'Gateway_EGLL'))).toBe(false);
    expect(await removeGatewayScenery(xplane, 'EGLL')).toEqual({
      ok: false,
      error: { code: 'NOT_INSTALLED', icao: 'EGLL' },
    });
  });
});
