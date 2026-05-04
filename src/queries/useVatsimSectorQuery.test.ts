import { describe, expect, it } from 'vitest';
import { getVatsimSectorQueryOptions, vatsimSectorKeys } from './useVatsimSectorQuery';

describe('getVatsimSectorQueryOptions', () => {
  it('keeps sector data immediately stale so the cache is rechecked when the layer is re-enabled', () => {
    const options = getVatsimSectorQueryOptions(true);

    expect(options.queryKey).toEqual(vatsimSectorKeys.all);
    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(0);
    expect(options.gcTime).toBe(30 * 60 * 1000);
  });
});
