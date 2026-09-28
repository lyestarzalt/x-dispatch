/**
 * Tests for the aircraft scanner's add-on version detection.
 *
 * Focus areas:
 *  - version.txt next to the .acf wins over acf/_version (Zibo: file carries
 *    the full "4.05.35", the .acf only "ver 4.05")
 *  - acf/_version is the fallback, with its "ver " prefix stripped
 *  - stock aircraft with neither source report an empty version
 *  - junk version.txt contents (prose, oversized files) are rejected
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
});
