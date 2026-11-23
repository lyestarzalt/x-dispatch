import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: { data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}));

const { loadFaaChartIndex } = await import('./faaChartIndexLoader');

const airport = (code: string) =>
  `<airport_name ID="X" apt_ident="GJT" icao_ident="KGJT"><record><chart_code>ODP</chart_code>` +
  `<faanfd18>${code}.JNC</faanfd18></record></airport_name>`;

let xplane: string;
const metafile = () => path.join(xplane, 'Custom Data', 'd-tpp_Metafile.xml');

beforeEach(() => {
  xplane = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-faa-charts-'));
  fs.mkdirSync(path.join(xplane, 'Custom Data'));
});
afterEach(() => fs.rmSync(xplane, { recursive: true, force: true }));

describe('loadFaaChartIndex', () => {
  it('is null when the user has not placed the file', () => {
    expect(loadFaaChartIndex(xplane)).toBeNull();
  });

  it('reads the file, again after it changes, and forgets it once removed', () => {
    fs.writeFileSync(metafile(), airport('MONMT3'));
    expect([...loadFaaChartIndex(xplane)!.obstacleDepartures.get('KGJT')!]).toEqual(['MONMT3']);

    fs.writeFileSync(metafile(), airport('MONMT4'));
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(metafile(), later, later);
    expect([...loadFaaChartIndex(xplane)!.obstacleDepartures.get('KGJT')!]).toEqual(['MONMT4']);

    fs.rmSync(metafile());
    expect(loadFaaChartIndex(xplane)).toBeNull();
  });
});
