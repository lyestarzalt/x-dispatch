import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: { data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}));

const {
  clearDownloadedFaaCharts,
  configureFaaChartDownload,
  downloadFaaCharts,
  downloadedFaaChartIndex,
  faaChartDownloadState,
  isUsAirport,
  onFaaChartsUpdated,
  requestFaaCharts,
} = await import('./faaChartDownload');

/** The chart list for a cycle, with one ILS OR LOC at KJFK. */
const metafile = (cycle: string) =>
  `<digital_tpp cycle="${cycle}" from_edate="x" to_edate="y">` +
  `<airport_name ID="JFK" military="N" apt_ident="JFK" icao_ident="KJFK">` +
  `<record><chart_code>IAP</chart_code><chart_name>ILS OR LOC RWY 04R</chart_name></record>` +
  `</airport_name></digital_tpp>`;

// 23 November 2026 is in cycle 2611.
const NOW = new Date(Date.UTC(2026, 10, 23, 12));

let dir: string;
let cachePath: string;
let enabled: boolean;
let now: Date;
let fetchText: ReturnType<typeof vi.fn>;

function configure() {
  configureFaaChartDownload({
    fetchText: fetchText as never,
    cachePath,
    isEnabled: () => enabled,
    now: () => now,
  });
}

/** Waits for the background download a request started. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-faa-download-'));
  cachePath = path.join(dir, 'faa-charts.json');
  enabled = true;
  now = NOW;
  fetchText = vi.fn(async (url: string) => ({
    data: metafile(/d-tpp\/(\d{4})\//.exec(url)![1]!),
    error: null,
  }));
  configure();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('requestFaaCharts', () => {
  it('downloads the current cycle when a US airport opens, and keeps what the app reads', async () => {
    const updated = vi.fn();
    onFaaChartsUpdated(updated);

    requestFaaCharts('KJFK');
    await settle();

    expect(fetchText).toHaveBeenCalledWith(
      'https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml'
    );
    expect([...downloadedFaaChartIndex()!.ilsOrLoc.get('KJFK')!]).toEqual(['I04R']);
    expect(faaChartDownloadState()).toMatchObject({ cycle: '2611', error: null });
    expect(updated).toHaveBeenCalledTimes(1);
    // The cache holds the reduced index, not the 16 MB file.
    expect(fs.readFileSync(cachePath, 'utf-8')).not.toContain('<record>');
  });

  it('reads the cache back after a restart', async () => {
    requestFaaCharts('KJFK');
    await settle();
    configure();
    expect(downloadedFaaChartIndex()?.cycle).toBe('2611');
  });

  it('downloads nothing for an airport outside the US', async () => {
    requestFaaCharts('EGLL');
    await settle();
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('downloads nothing, and offers nothing, once the user turns it off', async () => {
    requestFaaCharts('KJFK');
    await settle();
    enabled = false;
    expect(downloadedFaaChartIndex()).toBeNull();

    now = new Date(Date.UTC(2027, 0, 1));
    requestFaaCharts('KJFK');
    await settle();
    expect(fetchText).toHaveBeenCalledTimes(1);
  });

  it('downloads once per cycle and keeps the last list until the next one is in', async () => {
    requestFaaCharts('KJFK');
    requestFaaCharts('KBOS');
    await settle();
    requestFaaCharts('KLAX');
    await settle();
    expect(fetchText).toHaveBeenCalledTimes(1);

    now = new Date(Date.UTC(2026, 11, 1)); // 2612
    fetchText.mockImplementationOnce(() => new Promise(() => {}));
    requestFaaCharts('KJFK');
    expect(downloadedFaaChartIndex()?.cycle).toBe('2611');
    expect(faaChartDownloadState().downloading).toBe(true);
  });

  it('waits half an hour after a failure before trying again', async () => {
    fetchText.mockResolvedValueOnce({ data: null, error: 'Timeout after 120000ms' });
    requestFaaCharts('KJFK');
    await settle();
    expect(faaChartDownloadState().error).toBe('network');
    expect(downloadedFaaChartIndex()).toBeNull();

    now = new Date(NOW.getTime() + 10 * 60_000);
    requestFaaCharts('KJFK');
    await settle();
    expect(fetchText).toHaveBeenCalledTimes(1);

    now = new Date(NOW.getTime() + 31 * 60_000);
    requestFaaCharts('KJFK');
    await settle();
    expect(fetchText).toHaveBeenCalledTimes(2);
    expect(faaChartDownloadState().error).toBeNull();
  });
});

describe('downloadFaaCharts', () => {
  it('refuses a file for another cycle and keeps the list it had', async () => {
    await downloadFaaCharts();
    fetchText.mockResolvedValueOnce({ data: metafile('2609'), error: null });
    now = new Date(Date.UTC(2026, 11, 1));
    expect(await downloadFaaCharts()).toBe('invalid');
    expect(downloadedFaaChartIndex()?.cycle).toBe('2611');
  });

  it('refuses a page that is not the chart list', async () => {
    fetchText.mockResolvedValueOnce({ data: '<html>Maintenance</html>', error: null });
    expect(await downloadFaaCharts()).toBe('invalid');
    expect(fs.existsSync(cachePath)).toBe(false);
  });
});

describe('clearDownloadedFaaCharts', () => {
  it('deletes the downloaded list', async () => {
    await downloadFaaCharts();
    clearDownloadedFaaCharts();
    expect(fs.existsSync(cachePath)).toBe(false);
    expect(downloadedFaaChartIndex()).toBeNull();
    expect(faaChartDownloadState().cycle).toBeNull();
  });
});

describe('isUsAirport', () => {
  it.each(['KJFK', 'PANC', 'PHNL', 'PGUM', 'TJSJ', 'TIST'])('%s is in the chart list', (icao) => {
    expect(isUsAirport(icao)).toBe(true);
  });
  it.each(['EGLL', 'CYYZ', 'MMMX', 'RJTT', 'PKMJ'])('%s is not', (icao) => {
    expect(isUsAirport(icao)).toBe(false);
  });
});
