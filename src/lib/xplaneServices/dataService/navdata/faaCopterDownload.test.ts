import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: { data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}));

const {
  clearDownloadedFaaCopter,
  configureFaaCopterDownload,
  downloadFaaCopter,
  faaCifpUrl,
  faaCopterDownloadState,
  faaCopterForAirport,
  faaFixNear,
  onFaaCopterUpdated,
  requestFaaCopter,
} = await import('./faaCopterDownload');

// Real FAACIFP18 records of cycle 2611: KJRA and LaGuardia's COPTER RNAV (GPS) 250.
const sample = fs.readFileSync(
  path.resolve(__dirname, '../../../../../tests/fixtures/faacifp-copter-sample.txt'),
  'latin1'
);

// 23 November 2026 is in cycle 2611, in force from 29 October.
const NOW = new Date(Date.UTC(2026, 10, 23, 12));

let dir: string;
let cachePath: string;
let enabled: boolean;
let now: Date;
let download: ReturnType<typeof vi.fn>;
let extract: ReturnType<typeof vi.fn>;

function configure() {
  configureFaaCopterDownload({
    download: download as never,
    extract: extract as never,
    cachePath,
    isEnabled: () => enabled,
    now: () => now,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-faa-copter-'));
  cachePath = path.join(dir, 'faa-copter.json');
  enabled = true;
  now = NOW;
  download = vi.fn(async () => ({ data: Buffer.from('zip'), error: null }));
  extract = vi.fn(async () => sample);
  configure();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('faaCifpUrl', () => {
  it('names the archive by the first day of the cycle', () => {
    expect(faaCifpUrl('2611')).toBe('https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_261029.zip');
    expect(faaCifpUrl('2612')).toBe('https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_261126.zip');
    expect(faaCifpUrl('nope')).toBeNull();
  });
});

describe('FAA helicopter procedure download', () => {
  it('downloads the current cycle when an airport with a COPTER chart opens', async () => {
    requestFaaCopter(true);
    await settle();
    expect(download).toHaveBeenCalledWith(
      'https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_261029.zip'
    );
    expect(extract).toHaveBeenCalledWith(Buffer.from('zip'), 'FAACIFP18');
    expect(faaCopterForAirport('kjra')?.fixes.some((f) => f.id === 'HUDSN')).toBe(true);
    expect(faaCopterForAirport('KJFK')).toBeNull();
  });

  it('asks for nothing at an airport without a COPTER chart, or with the download off', async () => {
    requestFaaCopter(false);
    enabled = false;
    requestFaaCopter(true);
    await settle();
    expect(download).not.toHaveBeenCalled();
  });

  it('keeps the procedures on disk and does not download the same cycle twice', async () => {
    await downloadFaaCopter();
    configure();
    requestFaaCopter(true);
    await settle();
    expect(download).toHaveBeenCalledTimes(1);
    expect(faaCopterForAirport('KLGA')).not.toBeNull();
  });

  it('downloads again when the next cycle begins', async () => {
    await downloadFaaCopter();
    now = new Date(Date.UTC(2026, 10, 27, 12));
    extract.mockResolvedValue(sample.replace('3973042611', '3973042612'));
    requestFaaCopter(true);
    await settle();
    expect(download).toHaveBeenLastCalledWith(
      'https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_261126.zip'
    );
  });

  it('refuses a file of another cycle and keeps what it had', async () => {
    await downloadFaaCopter();
    now = new Date(Date.UTC(2026, 10, 27, 12));
    expect(await downloadFaaCopter()).toBe('invalid');
    expect(faaCopterForAirport('KJRA')).not.toBeNull();
  });

  it('waits before trying again after a failure', async () => {
    download.mockResolvedValue({ data: null, error: 'Timeout' });
    expect(await downloadFaaCopter()).toBe('network');
    requestFaaCopter(true);
    await settle();
    expect(download).toHaveBeenCalledTimes(1);
    now = new Date(NOW.getTime() + 31 * 60_000);
    requestFaaCopter(true);
    await settle();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('tells its listeners when procedures arrive and when they are cleared', async () => {
    const listener = vi.fn();
    onFaaCopterUpdated(listener);
    await downloadFaaCopter();
    expect(listener).toHaveBeenCalledTimes(1);
    clearDownloadedFaaCopter();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(faaCopterForAirport('KJRA')).toBeNull();
    expect(fs.existsSync(cachePath)).toBe(false);
  });

  it('returns nothing while the download is switched off', async () => {
    await downloadFaaCopter();
    enabled = false;
    expect(faaCopterForAirport('KJRA')).toBeNull();
  });

  // GitHub #432: HUDSN typed into the planner's route on stock X-Plane data, which lacks it.
  it('finds a fix by name for the planner, the nearest when the name is used twice', async () => {
    await downloadFaaCopter();
    const newYork = { latitude: 40.75, longitude: -74 };
    const hudsn = faaFixNear('hudsn', newYork)!;
    expect(hudsn.latitude).toBeCloseTo(40.791036, 5);
    expect(hudsn.longitude).toBeCloseTo(-73.985539, 5);
    expect(faaFixNear('NOSUCH', newYork)).toBeNull();
    enabled = false;
    expect(faaFixNear('HUDSN', newYork)).toBeNull();
  });

  it('reports what Settings shows: nothing yet, then the cycle, its date and the fix count', async () => {
    expect(faaCopterDownloadState()).toEqual({
      cycle: null,
      fetchedAt: null,
      downloading: false,
      error: null,
      fixCount: 0,
    });
    const pending = downloadFaaCopter();
    expect(faaCopterDownloadState().downloading).toBe(true);
    await pending;
    const state = faaCopterDownloadState();
    expect(state).toMatchObject({ cycle: '2611', downloading: false, error: null });
    expect(state.fetchedAt).toBe(NOW.toISOString());
    expect(state.fixCount).toBeGreaterThan(10);
    // The date survives a restart.
    configure();
    expect(faaCopterDownloadState().fetchedAt).toBe(NOW.toISOString());
  });

  it('reports why the last download failed', async () => {
    download.mockResolvedValue({ data: null, error: 'Timeout' });
    await downloadFaaCopter();
    expect(faaCopterDownloadState().error).toBe('network');
  });
});
