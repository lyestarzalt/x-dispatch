import { afterEach, describe, expect, it, vi } from 'vitest';
import { XPlaneRestClient } from './restClient';

afterEach(() => vi.unstubAllGlobals());

describe('startFlight validation at REST boundary', () => {
  it('rejects malformed runtime input before making a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await new XPlaneRestClient().startFlight({
      aircraft: { path: 'Aircraft/test.acf' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exactly one start location');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends a valid native gate payload unchanged under data', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ error_code: 'success' }) });
    vi.stubGlobal('fetch', fetch);
    const payload = {
      aircraft: { path: 'Aircraft/test.acf' },
      ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
    };
    expect(await new XPlaneRestClient().startFlight(payload)).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8086/api/v3/flight',
      expect.objectContaining({ body: JSON.stringify({ data: payload }) })
    );
  });

  it.each([{ error_code: 'missing_ramp' }, {}, null])(
    'does not mistake HTTP success for flight success: %j',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
      const result = await new XPlaneRestClient().startFlight({
        aircraft: { path: 'Aircraft/test.acf' },
        ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }
  );

  it('surfaces a non-success HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, text: async () => 'Missing ramp' })
    );
    const result = await new XPlaneRestClient().startFlight({
      aircraft: { path: 'Aircraft/test.acf' },
      ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
    });
    expect(result).toEqual({ success: false, error: 'Missing ramp' });
  });
});
