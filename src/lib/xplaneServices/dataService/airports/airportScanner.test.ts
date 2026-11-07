import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: {
    main: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { scanAptFile, standSizeCode } = await import('./airportScanner');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-scanner-'));
});

afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

function writeApt(lines: string[]): string {
  const file = path.join(tmpDir, 'apt.dat');
  fs.writeFileSync(file, ['I', '1200 Generated', '', ...lines, '99', ''].join('\n'));
  return file;
}

const RUNWAY = '100 45.00 1 0 0.00 1 2 1 06  41.65 -70.52 0 0 1 0 0 0 24  41.66 -70.51 0 0 1 0 0 0';

describe('standSizeCode', () => {
  it('reads the ICAO code letter of a 1301 row', () => {
    expect(standSizeCode('1301 E airline DLH LH')).toBe('E');
    expect(standSizeCode('1301 F cargo')).toBe('F');
  });

  it('ignores a blank or unknown size', () => {
    expect(standSizeCode('1301   general_aviation')).toBeUndefined();
    expect(standSizeCode('1301 Z ga')).toBeUndefined();
  });
});

describe('scanAptFile stand sizes', () => {
  it('keeps the widest stand code per airport', async () => {
    const file = writeApt([
      '1 10 0 0 KAAA Alpha Field',
      RUNWAY,
      '1300 41.65 -70.52 90.0 gate jets Gate 1',
      '1301 C airline',
      '1300 41.65 -70.52 90.0 gate heavy Gate 2',
      '1301 E airline',
      '1300 41.65 -70.52 90.0 tie_down props Spot 3',
      '1301 A general_aviation',
      '1 10 0 0 KBBB Bravo Strip',
      RUNWAY,
      '1300 41.65 -70.52 90.0 tie_down props Spot 1',
    ]);

    const { airports } = await scanAptFile(file);

    expect(airports.get('KAAA')?.maxStandCode).toBe('E');
    expect(airports.get('KBBB')?.maxStandCode).toBeUndefined();
  });
});
