import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers: Record<string, (req: { url: string }) => Promise<Response>> = {};
const fetchMock = vi.fn();
const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

vi.mock('electron', () => ({
  net: { fetch: (...args: unknown[]) => fetchMock(...args) },
  protocol: {
    handle: (scheme: string, fn: (req: { url: string }) => Promise<Response>) => {
      handlers[scheme] = fn;
    },
    registerSchemesAsPrivileged: vi.fn(),
  },
}));
vi.mock('@/lib/utils/logger', () => ({ default: { main: log } }));
vi.mock('./index', () => ({
  getTileCache: () => ({ get: vi.fn().mockResolvedValue(null), put: vi.fn() }),
}));

describe('tile cache protocol handler', () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    Object.values(log).forEach((fn) => fn.mockReset());
    const { registerTileCacheHandler } = await import('./protocolHandler');
    registerTileCacheHandler();
  });

  it('treats a tile that cannot be downloaded as a warning, not a reported error', async () => {
    fetchMock.mockRejectedValue(new Error('net::ERR_FAILED'));

    const response = await handlers['tile-cache']!({
      url: 'tile-cache://server.arcgisonline.com/tile/3/1/6',
    });

    expect(response.status).toBe(502);
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('server.arcgisonline.com'));
    expect(log.warn.mock.calls[0]).toHaveLength(1);
  });
});
