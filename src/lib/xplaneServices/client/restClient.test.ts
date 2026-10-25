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

describe('startFlight rejection parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const payload = {
    aircraft: { path: 'Aircraft/test.acf' },
    ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
  };

  it("keeps X-Plane's error code and message from a 400 body", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error_code: 'missing_ramp',
            error_message: "Failed to parse ramp start, ramp 'GA5' is not recognized",
          }),
      })
    );
    expect(await new XPlaneRestClient().startFlight(payload)).toEqual({
      success: false,
      code: 'missing_ramp',
      error: "Failed to parse ramp start, ramp 'GA5' is not recognized",
    });
  });

  it('keeps the code when a 200 body carries one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error_code: 'missing_aircraft', error_message: 'no such file' }),
      })
    );
    expect(await new XPlaneRestClient().startFlight(payload)).toEqual({
      success: false,
      code: 'missing_aircraft',
      error: 'no such file',
    });
  });

  it('falls back to the raw body when the error is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => '<html>bad gateway' })
    );
    const result = await new XPlaneRestClient().startFlight(payload);
    expect(result.success).toBe(false);
    expect(result.code).toBeUndefined();
    expect(result.error).toBe('<html>bad gateway');
  });
});

// X-Plane stops answering while it loads the new flight: the open connection drops before a
// response is written, or nothing comes back at all. The flight loads anyway.
describe('startFlight when the connection breaks during the load', () => {
  const payload = {
    aircraft: { path: 'Aircraft/test.acf' },
    ramp_start: { airport_id: 'LFLS', ramp: 'Gate 9' },
  };
  const timing = { requestTimeoutMs: 30, recoveryWindowMs: 200, recoveryProbeMs: 5 };
  const reset = (xplaneBack: boolean) => {
    const dropped = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
    });
    const fetch = vi.fn((url: string) =>
      url.endsWith('/flight')
        ? Promise.reject(dropped)
        : xplaneBack
          ? Promise.resolve({ ok: true })
          : Promise.reject(new TypeError('fetch failed'))
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('takes the change as accepted when X-Plane answers again, and says why it had to', async () => {
    reset(true);
    const result = await new XPlaneRestClient(8086, timing).startFlight(payload);
    expect(result).toEqual({ success: true, connectionDropped: 'ECONNRESET: socket hang up' });
  });

  it('fails with the real reason when X-Plane never comes back', async () => {
    const fetch = reset(false);
    const result = await new XPlaneRestClient(8086, timing).startFlight(payload);
    expect(result.success).toBe(false);
    expect(result.code).toBeUndefined();
    expect(result.connectionDropped).toBe('ECONNRESET: socket hang up');
    expect(result.error).toContain('ECONNRESET: socket hang up');
    // Probed more than once across the recovery window.
    expect(fetch.mock.calls.filter(([url]) => !url.endsWith('/flight')).length).toBeGreaterThan(2);
  });

  it('gives up waiting for an answer and probes instead of hanging', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url.endsWith('/flight')
        ? new Promise((_, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))
            )
          )
        : Promise.resolve({ ok: true })
    );
    vi.stubGlobal('fetch', fetch);
    const result = await new XPlaneRestClient(8086, timing).startFlight(payload);
    expect(result).toEqual({ success: true, connectionDropped: 'no answer within 30 ms' });
  });
});
