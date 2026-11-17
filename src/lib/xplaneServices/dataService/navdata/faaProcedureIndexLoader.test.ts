import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  default: { data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}));

const { loadFaaProcedureIndex } = await import('./faaProcedureIndexLoader');

let xplane: string;
const indexFile = () => path.join(xplane, 'Custom Data', 'IN_CIFP.txt');

beforeEach(() => {
  xplane = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-faa-'));
  fs.mkdirSync(path.join(xplane, 'Custom Data'));
});
afterEach(() => fs.rmSync(xplane, { recursive: true, force: true }));

describe('loadFaaProcedureIndex', () => {
  it('is null when the user has not placed the file', () => {
    expect(loadFaaProcedureIndex(xplane)).toBeNull();
  });

  it('reads the file, and again after it changes', () => {
    fs.writeFileSync(
      indexFile(),
      'Arpt_ICAO\tProcedure Type\tProcedure Ident\r\nKBOS\tSIAP\tI04R\r\n'
    );
    expect([...loadFaaProcedureIndex(xplane)!.get('KBOS')!]).toEqual(['I04R']);

    fs.writeFileSync(indexFile(), 'KBOS\tSIAP\tI04R\r\nKBOS\tSIAP\tL04R\r\n');
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(indexFile(), later, later);
    expect([...loadFaaProcedureIndex(xplane)!.get('KBOS')!].sort()).toEqual(['I04R', 'L04R']);
  });

  it('forgets the index once the file is removed', () => {
    fs.writeFileSync(indexFile(), 'KBOS\tSIAP\tI04R\r\n');
    expect(loadFaaProcedureIndex(xplane)).not.toBeNull();
    fs.rmSync(indexFile());
    expect(loadFaaProcedureIndex(xplane)).toBeNull();
  });
});
