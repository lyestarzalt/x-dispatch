import { describe, expect, it } from 'vitest';
import { sevenZipListEntry } from './ArchiveScanner';

describe('sevenZipListEntry', () => {
  it('maps a 7-Zip listing row to an archive entry', () => {
    expect(
      sevenZipListEntry({
        file: 'ATR 72/ATR72.acf',
        attributes: '....A',
        size: 120,
        sizeCompressed: 40,
        encrypted: '-',
      })
    ).toEqual({
      path: 'ATR 72/ATR72.acf',
      isDirectory: false,
      uncompressedSize: 120,
      compressedSize: 40,
      encrypted: false,
    });
  });

  it('marks a directory row', () => {
    expect(sevenZipListEntry({ file: 'ATR 72', attributes: 'D....' })?.isDirectory).toBe(true);
  });

  // Sentry X-DISPATCH-9E, -9F: 7-Zip emits rows with no path, and the installer
  // then read `.endsWith` and `.split` on undefined.
  it('drops a row that has no path', () => {
    expect(sevenZipListEntry({ attributes: '....A', size: 10 })).toBeNull();
    expect(sevenZipListEntry({ file: '', size: 10 })).toBeNull();
  });
});
