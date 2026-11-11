/**
 * Tests for the aircraft scanner's add-on version detection.
 *
 * Focus areas:
 *  - a version*.txt next to the .acf wins over acf/_version (the file carries
 *    the full "4.05.35", the .acf only "ver 4.05")
 *  - acf/_version is the fallback, with its "ver " prefix stripped
 *  - stock aircraft with neither source report an empty version
 *  - junk version*.txt contents (prose, free text, oversized files) are rejected
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanAircraftDirectory } from './acfParser';

vi.mock('@/lib/utils/logger', () => {
  const noop = () => {};
  const channel = { info: noop, warn: noop, error: noop, debug: noop };
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      main: channel,
      data: channel,
      ipc: channel,
      security: channel,
      launcher: channel,
      tracker: channel,
      addon: channel,
    },
  };
});

let TEMP_ROOT: string;

function makeAircraft(name: string, acfLines: string[], versionTxt?: string): string {
  const dir = path.join(TEMP_ROOT, 'Aircraft', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.acf`), ['I', '1200 version', ...acfLines].join('\n'));
  if (versionTxt !== undefined) {
    fs.writeFileSync(path.join(dir, 'version.txt'), versionTxt);
  }
  return dir;
}

beforeEach(() => {
  TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-acf-test-'));
});

afterEach(() => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe('aircraft version detection', () => {
  it('prefers version.txt over acf/_version', async () => {
    makeAircraft('B738X', ['P acf/_name Boeing 737-800X', 'P acf/_version ver 4.05'], '4.05.35\n');

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('4.05.35');
  });

  it('falls back to acf/_version with the ver prefix stripped', async () => {
    makeAircraft('B738X', ['P acf/_name Boeing 737-800X', 'P acf/_version ver 4.05']);

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('4.05');
  });

  it('reports an empty version when neither source exists', async () => {
    makeAircraft('C172', ['P acf/_name Cessna 172']);

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('');
  });

  it('rejects a version.txt that does not look like a version', async () => {
    makeAircraft('Junk', ['P acf/_name Junk'], 'see the changelog for details\n');

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('');
  });

  it('rejects an oversized version.txt', async () => {
    makeAircraft('Big', ['P acf/_name Big'], '1.0\n' + 'x'.repeat(500));

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('');
  });

  it('reads per-model version files like version-777.txt', async () => {
    const dir = makeAircraft('B772', ['P acf/_name Boeing 777', 'P acf/_version For X-Plane 11']);
    fs.writeFileSync(path.join(dir, 'version-777.txt'), '020523\n');

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('020523');
  });

  it('rejects free-text acf/_version values', async () => {
    makeAircraft('B772', ['P acf/_name Boeing 777', 'P acf/_version For X-Plane 11']);

    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.version).toBe('');
  });
});

describe('livery pictures', () => {
  function livery(aircraftDir: string, name: string, files: string[]): void {
    const dir = path.join(aircraftDir, 'liveries', name);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of files) fs.writeFileSync(path.join(dir, file), '');
  }

  it('shows the picture named after the .acf, as X-Plane does', async () => {
    // One livery folder serves every 737 model; each model has its own picture.
    const dir = makeAircraft('737_80NG', []);
    livery(dir, 'United', ['737_60NG_icon11.png', '737_80NG_icon11.png', '737_90NG_icon11.png']);
    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    const united = aircraft?.liveries.find((l) => l.name === 'United');
    expect(path.basename(united?.previewImage ?? '')).toBe('737_80NG_icon11.png');
  });

  it("falls back to icon11.png, then to another model's picture", async () => {
    const dir = makeAircraft('Cessna_172SP', []);
    livery(dir, 'Plain', ['Cessna_172SP_G1000_icon11.png', 'icon11.png']);
    livery(dir, 'Other', ['Cessna_172SP_G1000_icon11.png']);
    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    const picture = (name: string) =>
      path.basename(aircraft?.liveries.find((l) => l.name === name)?.previewImage ?? '');
    expect(picture('Plain')).toBe('icon11.png');
    expect(picture('Other')).toBe('Cessna_172SP_G1000_icon11.png');
  });
});

describe('X-Plane version the .acf was saved for', () => {
  function writeAcf(name: string, header: string[]): void {
    const dir = path.join(TEMP_ROOT, 'Aircraft', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${name}.acf`),
      [...header, 'ACF', 'P acf/_name Test'].join('\r\n')
    );
  }

  it('reads 12 from a Plane Maker 12 header and 11 from an older one', async () => {
    writeAcf('New', ['I', '1200 Version']);
    writeAcf('Old', ['I', ' 1100 Version']);
    const aircraft = await scanAircraftDirectory(TEMP_ROOT);
    const version = (dir: string) =>
      aircraft.find((a) => a.path.includes(`/${dir}/`))?.xplaneVersion;
    expect(version('New')).toBe(12);
    expect(version('Old')).toBe(11);
  });

  it('leaves it unknown when the header has no version line', async () => {
    writeAcf('Odd', ['I', 'something else']);
    const [aircraft] = await scanAircraftDirectory(TEMP_ROOT);
    expect(aircraft?.xplaneVersion).toBeNull();
  });
});
