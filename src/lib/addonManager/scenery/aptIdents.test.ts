import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readAptIdents } from './aptIdents';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-apt-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function apt(content: string): string {
  const file = path.join(dir, 'apt.dat');
  fs.writeFileSync(file, content);
  return file;
}

describe('readAptIdents', () => {
  it('reads land, sea and heli airports, in order and once each', async () => {
    const file = apt(
      [
        'I',
        '1000 Version - data cycle 2024.01',
        '',
        '1 13 0 0 EGLL Heathrow',
        '100 45.11 1 0 0.00 1 3 0 09L ...',
        '16 0 0 0 EGSB Sea Base',
        '17 50 0 0 EGHX Heli',
        '1 13 0 0 EGLL Heathrow again',
        '99',
      ].join('\n')
    );
    expect(await readAptIdents(file)).toEqual(['EGLL', 'EGSB', 'EGHX']);
  });

  it('lets a 1302 icao_code row replace the header identifier', async () => {
    const file = apt(
      [
        'I',
        '1000 Version',
        '1 10 0 0 X123 Somewhere',
        '1302 icao_code LFXX',
        '1302 city Nowhere',
        '99',
      ].join('\n')
    );
    expect(await readAptIdents(file)).toEqual(['LFXX']);
  });

  it('stops at the 99 row and copes with Windows line endings', async () => {
    const file = apt(
      'I\r\n1000 Version\r\n1 10 0 0 KSEA Seattle\r\n99\r\n1 10 0 0 KJFK Ignored\r\n'
    );
    expect(await readAptIdents(file)).toEqual(['KSEA']);
  });
});
