import { describe, expect, it } from 'vitest';
import type { ArchiveEntry } from '../types';
import { detectSceneryVariants } from './sceneryVariants';

function entry(p: string, size = 10, crc32?: number): ArchiveEntry {
  return {
    path: p,
    isDirectory: p.endsWith('/'),
    uncompressedSize: size,
    compressedSize: size,
    encrypted: false,
    crc32,
  };
}

describe('detectSceneryVariants', () => {
  it('offers each child of an options folder, mapping its tiles under Earth nav data', () => {
    const variants = detectSceneryVariants(
      [
        entry('EGLL/'),
        entry('EGLL/Earth nav data/apt.dat', 50),
        entry('EGLL/Earth nav data/+50-001/+51-001.dsf', 100),
        entry('EGLL/Options/No trees/Earth nav data/+50-001/+51-001.dsf', 90),
        entry('EGLL/Options/No trees/readme.txt', 5),
        entry('EGLL/Options/Winter/Earth nav data/+50-001/+51-001.dsf', 95),
        entry('EGLL/Options/Winter/Earth nav data/apt.dat', 51),
      ],
      'EGLL/'
    );
    expect(variants).toEqual([
      {
        root: 'EGLL/Options/No trees/',
        name: 'No trees',
        files: [
          {
            source: 'EGLL/Options/No trees/Earth nav data/+50-001/+51-001.dsf',
            destination: 'Earth nav data/+50-001/+51-001.dsf',
            size: 90,
          },
        ],
      },
      {
        root: 'EGLL/Options/Winter/',
        name: 'Winter',
        files: [
          {
            source: 'EGLL/Options/Winter/Earth nav data/+50-001/+51-001.dsf',
            destination: 'Earth nav data/+50-001/+51-001.dsf',
            size: 95,
          },
          {
            source: 'EGLL/Options/Winter/Earth nav data/apt.dat',
            destination: 'Earth nav data/apt.dat',
            size: 51,
          },
        ],
      },
    ]);
  });

  it('treats a lone variant folder as the option and matches bare tiles by name', () => {
    const variants = detectSceneryVariants(
      [
        entry('Earth nav data/+47+008.dsf', 100),
        entry('Alternative layout/+47+008.dsf', 80),
        entry('Alternative layout/notes.pdf', 3),
      ],
      ''
    );
    expect(variants).toEqual([
      {
        root: 'Alternative layout/',
        name: 'Alternative layout',
        files: [
          {
            source: 'Alternative layout/+47+008.dsf',
            destination: 'Earth nav data/+47+008.dsf',
            size: 80,
          },
        ],
      },
    ]);
  });

  it('drops an option that is byte for byte the base, and folders without navigation files', () => {
    const variants = detectSceneryVariants(
      [
        entry('P/Earth nav data/+47+008.dsf', 100, 0xabc),
        entry('P/Options/Default/Earth nav data/+47+008.dsf', 100, 0xabc),
        entry('P/Options/Docs/readme.txt', 2),
        entry('P/Options/Lite/Earth nav data/+47+008.dsf', 100, 0xdef),
      ],
      'P/'
    );
    expect(variants.map((v) => v.name)).toEqual(['Lite']);
  });

  it('ignores the base pack itself and folders outside the package', () => {
    expect(
      detectSceneryVariants(
        [entry('P/Earth nav data/apt.dat', 5), entry('Other options/Earth nav data/apt.dat', 5)],
        'P/'
      )
    ).toEqual([]);
  });
});
