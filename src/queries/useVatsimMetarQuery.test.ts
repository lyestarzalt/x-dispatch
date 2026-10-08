import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVatsimMetar } from './useVatsimMetarQuery';

function stubMetarResponse(response: { data: string | null; error?: string }) {
  vi.stubGlobal('window', {
    airportAPI: { fetchVatsimMetar: vi.fn().mockResolvedValue(response) },
  });
}

describe('fetchVatsimMetar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws on a network error so the last good METAR is kept and retried', async () => {
    stubMetarResponse({ data: null, error: 'net::ERR_INTERNET_DISCONNECTED' });
    await expect(fetchVatsimMetar('EGLL')).rejects.toThrow('ERR_INTERNET_DISCONNECTED');
  });

  it('returns null when the station has no METAR', async () => {
    stubMetarResponse({ data: '' });
    await expect(fetchVatsimMetar('XXXX')).resolves.toBeNull();
  });

  it('parses a METAR', async () => {
    stubMetarResponse({ data: 'EGLL 081150Z 24012KT 9999 FEW030 15/08 Q1015' });
    const result = await fetchVatsimMetar('EGLL');
    expect(result?.flightCategory).toBe('VFR');
  });
});
