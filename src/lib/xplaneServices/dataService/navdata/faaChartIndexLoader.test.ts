import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: { data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}));

const { configureFaaChartDownload, downloadFaaCharts } = await import('./faaChartDownload');
const { faaChartStatus, faaChartsForAirport, loadFaaChartIndex } =
  await import('./faaChartIndexLoader');

// 23 November 2026 is in cycle 2611, which ends on 26 November.
const NOW = new Date(Date.UTC(2026, 10, 23, 12));

/** The FAA's list for a cycle: KSEA's ILS OR LOC RWY 16C and KGJT's obstacle departure. */
const chartList = (cycle: string) =>
  `<digital_tpp cycle="${cycle}">` +
  `<airport_name ID="SEATTLE-TACOMA INTL" apt_ident="SEA" icao_ident="KSEA">` +
  `<record><chart_code>IAP</chart_code><chart_name>ILS OR LOC RWY 16C</chart_name>` +
  `<pdf_name>00582IL16C.PDF</pdf_name><civil>C</civil></record></airport_name>` +
  `<airport_name ID="GRAND JUNCTION RGNL" apt_ident="GJT" icao_ident="KGJT">` +
  `<record><chart_code>ODP</chart_code><chart_name>MONUMENT THREE (OBSTACLE)</chart_name>` +
  `<pdf_name>00173MONUMENT.PDF</pdf_name><faanfd18>MONMT3.JNC</faanfd18></record></airport_name>` +
  `</digital_tpp>`;

let dir: string;
let enabled: boolean;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-faa-charts-'));
  enabled = true;
  configureFaaChartDownload({
    fetchText: (async (url: string) => ({
      data: chartList(/d-tpp\/(\d{4})\//.exec(url)![1]!),
      error: null,
    })) as never,
    cachePath: path.join(dir, 'faa-charts.json'),
    isEnabled: () => enabled,
    now: () => NOW,
  });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('loadFaaChartIndex', () => {
  it('is null until the list has been downloaded', () => {
    expect(loadFaaChartIndex()).toBeNull();
  });

  it('is the downloaded list, and nothing once the download is switched off', async () => {
    await downloadFaaCharts();
    expect([...loadFaaChartIndex()!.obstacleDepartures.get('KGJT')!]).toEqual(['MONMT3']);
    enabled = false;
    expect(loadFaaChartIndex()).toBeNull();
  });
});

describe('faaChartsForAirport', () => {
  it('links each chart to its PDF in the cycle folder', async () => {
    await downloadFaaCharts();
    expect(faaChartsForAirport('ksea', NOW)).toEqual({
      cycle: '2611',
      expired: false,
      charts: [
        {
          code: 'IAP',
          name: 'ILS OR LOC RWY 16C',
          url: 'https://aeronav.faa.gov/d-tpp/2611/00582IL16C.PDF',
          overlay: true,
        },
      ],
    });
  });

  it('has nothing for an airport the FAA does not chart, or without a list', async () => {
    expect(faaChartsForAirport('KSEA')).toBeNull();
    await downloadFaaCharts();
    expect(faaChartsForAirport('EGLL')).toBeNull();
  });

  it('says so when the list is from a cycle that has ended', async () => {
    await downloadFaaCharts();
    expect(faaChartsForAirport('KSEA', new Date(Date.UTC(2026, 11, 5)))!.expired).toBe(true);
  });
});

describe('faaChartStatus', () => {
  it('names the download, with the cycle it is for and when it runs out', async () => {
    await downloadFaaCharts();
    expect(faaChartStatus(NOW)).toMatchObject({
      source: 'download',
      cycle: '2611',
      validUntil: '2026-11-26T00:00:00.000Z',
      expired: false,
      fetchedAt: NOW.toISOString(),
    });
    expect(faaChartStatus(new Date(Date.UTC(2026, 11, 5))).expired).toBe(true);
  });

  it('says there is no list before the first download', () => {
    expect(faaChartStatus()).toMatchObject({ source: 'none', cycle: null, expired: false });
  });
});
