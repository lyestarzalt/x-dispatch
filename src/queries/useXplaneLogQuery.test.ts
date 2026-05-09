import { useQuery } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useXplaneLogQuery, xplaneLogKeys } from './useXplaneLogQuery';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ isSuccess: false, data: undefined })),
}));

afterEach(() => {
  vi.mocked(useQuery).mockClear();
  delete (globalThis as unknown as { window?: Window }).window;
});

describe('useXplaneLogQuery', () => {
  it('exposes the expected query keys', () => {
    expect(xplaneLogKeys.all).toEqual(['xplane-log']);
    expect(xplaneLogKeys.read).toEqual(['xplane-log', 'read']);
  });

  it('passes enabled=false through to useQuery', () => {
    useXplaneLogQuery(false);
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        queryKey: xplaneLogKeys.read,
        staleTime: 0,
        gcTime: 60_000,
        refetchOnWindowFocus: false,
      })
    );
  });

  it('passes enabled=true and a queryFn that calls window.xpLogAPI.read', async () => {
    const readMock = vi.fn().mockResolvedValue({
      kind: 'ok',
      data: 'log content',
      fullByteSize: 100,
      truncated: false,
    });
    (globalThis as unknown as { window: Window }).window = {
      xpLogAPI: { read: readMock },
    } as unknown as Window;

    useXplaneLogQuery(true);
    const args = vi.mocked(useQuery).mock.calls[0]?.[0];
    expect(args?.enabled).toBe(true);

    const result = await args?.queryFn?.({} as never);
    expect(readMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      kind: 'ok',
      data: 'log content',
      fullByteSize: 100,
      truncated: false,
    });
  });
});
