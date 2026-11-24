import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: { data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}));

const { configureFaaChartPdf, loadFaaChartPdf } = await import('./faaChartPdf');

// KSEA ILS OR LOC RWY 16C, as the chart list of cycle 2612 names it.
const KSEA = 'https://aeronav.faa.gov/d-tpp/2612/00582IL16C.PDF';
const PDF = Buffer.from('%PDF-1.6 chart');

let cacheDir: string;
let download: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-faa-pdf-'));
  download = vi.fn(async () => ({ data: PDF, error: null }));
  configureFaaChartPdf({ download: download as never, cacheDir });
});
afterEach(() => fs.rmSync(cacheDir, { recursive: true, force: true }));

describe('loadFaaChartPdf', () => {
  it('downloads a chart once and reads it from disk after that', async () => {
    expect(await loadFaaChartPdf(KSEA)).toEqual({ pdf: PDF.toString('base64') });
    expect(await loadFaaChartPdf(KSEA)).toEqual({ pdf: PDF.toString('base64') });
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(KSEA);
    expect(fs.existsSync(path.join(cacheDir, '2612', '00582IL16C.PDF'))).toBe(true);
  });

  it('joins a download already running for the same chart', async () => {
    const [a, b] = await Promise.all([loadFaaChartPdf(KSEA), loadFaaChartPdf(KSEA)]);
    expect(a).toEqual(b);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('asks nothing of an address that is not an FAA chart', async () => {
    for (const url of [
      'https://example.com/d-tpp/2612/00582IL16C.PDF',
      'https://aeronav.faa.gov/d-tpp/2612/../../secret.PDF',
      'https://aeronav.faa.gov/d-tpp/2612/xml_data/d-tpp_Metafile.xml',
      'http://aeronav.faa.gov/d-tpp/2612/00582IL16C.PDF',
      42,
    ]) {
      expect(await loadFaaChartPdf(url)).toEqual({ error: 'invalidUrl' });
    }
    expect(download).not.toHaveBeenCalled();
  });

  it('reports a failed download and keeps nothing', async () => {
    download.mockResolvedValueOnce({ data: null, error: 'Timeout after 30000ms' });
    expect(await loadFaaChartPdf(KSEA)).toEqual({ error: 'network' });
    expect(fs.existsSync(path.join(cacheDir, '2612'))).toBe(false);
  });

  it('tells a chart the FAA no longer serves from a failed connection', async () => {
    download.mockResolvedValueOnce({ data: null, error: 'HTTP 404' });
    expect(await loadFaaChartPdf(KSEA)).toEqual({ error: 'missing' });
    download.mockResolvedValueOnce({ data: null, error: 'HTTP 503' });
    expect(await loadFaaChartPdf(KSEA)).toEqual({ error: 'network' });
  });

  it('refuses an answer that is not a PDF, as a maintenance page', async () => {
    download.mockResolvedValueOnce({ data: Buffer.from('<html>down</html>'), error: null });
    expect(await loadFaaChartPdf(KSEA)).toEqual({ error: 'invalid' });
    expect(fs.existsSync(path.join(cacheDir, '2612', '00582IL16C.PDF'))).toBe(false);
  });

  it('drops the charts of another cycle when a new cycle comes in', async () => {
    fs.mkdirSync(path.join(cacheDir, '2611'));
    fs.writeFileSync(path.join(cacheDir, '2611', '00582IL16C.PDF'), PDF);
    await loadFaaChartPdf(KSEA);
    expect(fs.existsSync(path.join(cacheDir, '2611'))).toBe(false);
    expect(fs.existsSync(path.join(cacheDir, '2612', '00582IL16C.PDF'))).toBe(true);
  });
});
