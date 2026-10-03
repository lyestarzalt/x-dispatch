import { describe, expect, it } from 'vitest';
import type { ThirdPartyNotice } from '@/types/notices';
import { filterNotices, licenseSummary } from './thirdPartyNotices';

const n = (name: string, license: string): ThirdPartyNotice => ({
  name,
  version: '1.0.0',
  license,
  repository: null,
  text: '',
});
const entries = [n('react', 'MIT'), n('maplibre-gl', 'BSD-3-Clause'), n('7-Zip', 'LGPL-2.1')];

describe('filterNotices', () => {
  it('matches on name or licence, ignoring case, and keeps everything for an empty query', () => {
    expect(filterNotices(entries, '')).toHaveLength(3);
    expect(filterNotices(entries, 'MAP').map((e) => e.name)).toEqual(['maplibre-gl']);
    expect(filterNotices(entries, 'mit').map((e) => e.name)).toEqual(['react']);
    expect(filterNotices(entries, 'nothing')).toEqual([]);
  });
});

describe('licenseSummary', () => {
  it('counts components per licence, most common first', () => {
    expect(licenseSummary([...entries, n('clsx', 'MIT')])).toEqual([
      { license: 'MIT', count: 2 },
      { license: 'BSD-3-Clause', count: 1 },
      { license: 'LGPL-2.1', count: 1 },
    ]);
  });
});
