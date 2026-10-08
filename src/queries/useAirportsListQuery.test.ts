import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { airportsListQuery, setAirportsList } from './useAirportsListQuery';

const EGLL = { icao: 'EGLL' } as Airport;
const LFPG = { icao: 'LFPG' } as Airport;

describe('airports list cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves the list App already loaded, without a second IPC fetch', async () => {
    const client = new QueryClient();
    const getAirports = vi.fn().mockResolvedValue([LFPG]);
    vi.stubGlobal('window', { airportAPI: { getAirports } });

    setAirportsList(client, [EGLL]);

    await expect(client.ensureQueryData(airportsListQuery)).resolves.toEqual([EGLL]);
    expect(getAirports).not.toHaveBeenCalled();
  });

  it('replaces the cached list after a scenery rescan', () => {
    const client = new QueryClient();
    setAirportsList(client, [EGLL]);
    setAirportsList(client, [EGLL, LFPG]);
    expect(client.getQueryData(airportsListQuery.queryKey)).toEqual([EGLL, LFPG]);
  });

  it('treats an empty list as loaded, not missing (an install with no airports)', async () => {
    const client = new QueryClient();
    const getAirports = vi.fn().mockResolvedValue([LFPG]);
    vi.stubGlobal('window', { airportAPI: { getAirports } });

    setAirportsList(client, []);

    await expect(client.ensureQueryData(airportsListQuery)).resolves.toEqual([]);
    expect(getAirports).not.toHaveBeenCalled();
  });

  it('still fetches over IPC when Settings opens before App seeded the list', async () => {
    const client = new QueryClient();
    const getAirports = vi.fn().mockResolvedValue([LFPG]);
    vi.stubGlobal('window', { airportAPI: { getAirports } });

    await expect(client.ensureQueryData(airportsListQuery)).resolves.toEqual([LFPG]);
    expect(getAirports).toHaveBeenCalledTimes(1);
  });

  it('lets a later seed replace a list Settings fetched on its own', async () => {
    const client = new QueryClient();
    vi.stubGlobal('window', { airportAPI: { getAirports: vi.fn().mockResolvedValue([LFPG]) } });
    await client.ensureQueryData(airportsListQuery);

    setAirportsList(client, [EGLL]);

    expect(client.getQueryData(airportsListQuery.queryKey)).toEqual([EGLL]);
  });

  it('surfaces an IPC failure as a query error, not a crash', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('window', {
      airportAPI: { getAirports: vi.fn().mockRejectedValue(new Error('db closed')) },
    });

    await expect(client.fetchQuery(airportsListQuery)).rejects.toThrow('db closed');
    expect(client.getQueryState(airportsListQuery.queryKey)?.status).toBe('error');
  });
});
