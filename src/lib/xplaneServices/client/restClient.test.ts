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
    expect(result).toMatchObject({
      success: false,
      reason: 'invalid_payload',
      error: expect.stringContaining('exactly one start location'),
    });
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

  it.each([
    [{ error_code: 'missing_ramp' }, 'xplane_rejected'],
    [{}, 'invalid_response'],
    [null, 'invalid_response'],
  ])('does not mistake HTTP success for flight success: %j', async (body, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    const result = await new XPlaneRestClient().startFlight({
      aircraft: { path: 'Aircraft/test.acf' },
      ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
    });
    expect(result).toMatchObject({ success: false, reason, error: expect.any(String) });
    expect(result.success ? '' : result.error).toBeTruthy();
  });

  it('surfaces a non-success HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Missing ramp' })
    );
    const result = await new XPlaneRestClient().startFlight({
      aircraft: { path: 'Aircraft/test.acf' },
      ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
    });
    expect(result).toEqual({
      success: false,
      reason: 'http_error',
      httpStatus: 500,
      error: 'Missing ramp',
    });
  });

  it('names an unreadable body instead of passing it off as a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      })
    );
    const result = await new XPlaneRestClient().startFlight({
      aircraft: { path: 'Aircraft/test.acf' },
      ramp_start: { airport_id: 'YRED', ramp: 'GA5' },
    });
    expect(result).toMatchObject({ success: false, reason: 'invalid_response' });
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
      reason: 'xplane_rejected',
      httpStatus: 400,
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
      reason: 'xplane_rejected',
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
    expect(result).toEqual({
      success: false,
      reason: 'http_error',
      httpStatus: 502,
      error: '<html>bad gateway',
    });
  });
});

// X-Plane stops answering while it loads the new flight: the open connection drops before a
// response is written, or nothing comes back at all. The flight loads anyway.
describe('startFlight when the connection breaks during the load', () => {
  const payload = {
    aircraft: { path: 'Aircraft/test.acf' },
    ramp_start: { airport_id: 'LFLS', ramp: 'Gate 9' },
  };
  const timing = {
    requestTimeoutMs: 30,
    recoveryWindowMs: 200,
    slowLoadWindowMs: 200,
    recoveryProbeMs: 5,
  };
  const xplaneClosed = async () => false;
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
    const result = await new XPlaneRestClient(8086, timing, xplaneClosed).startFlight(payload);
    expect(result).toEqual({
      success: false,
      reason: 'connection_lost',
      connectionDropped: 'ECONNRESET: socket hang up',
      error: expect.stringContaining('ECONNRESET: socket hang up'),
    });
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

// X-DISPATCH-6N: on a slow machine X-Plane is still loading the flight, its web server
// silent, long after the usual recovery window. Its process is alive the whole time.
describe('startFlight on a machine that loads slowly', () => {
  const payload = {
    aircraft: { path: 'Aircraft/Laminar Research/McDonnell Douglas MD-82/MD80.acf' },
    runway_start: { airport_id: 'CYYZ', runway: '06R' },
  };
  const timing = {
    requestTimeoutMs: 20,
    recoveryWindowMs: 40,
    slowLoadWindowMs: 1_000,
    recoveryProbeMs: 5,
  };
  /** X-Plane's web server stays silent for `silentMs` after the request, then answers. */
  const silentFor = (silentMs: number) => {
    const sent = Date.now();
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/flight')) {
        return new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))
          )
        );
      }
      return Date.now() - sent >= silentMs
        ? Promise.resolve({ ok: true })
        : Promise.reject(new TypeError('fetch failed'));
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('keeps waiting past the usual window while X-Plane is still running', async () => {
    silentFor(200);
    const result = await new XPlaneRestClient(8086, timing, async () => true).startFlight(payload);
    expect(result).toEqual({ success: true, connectionDropped: 'no answer within 20 ms' });
  });

  it('stops at the usual window once X-Plane has closed', async () => {
    silentFor(10_000);
    const started = Date.now();
    const result = await new XPlaneRestClient(8086, timing, async () => false).startFlight(payload);
    expect(result).toMatchObject({ success: false, reason: 'connection_lost' });
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('gives up at the long window even if X-Plane never answers', async () => {
    silentFor(10_000);
    const result = await new XPlaneRestClient(
      8086,
      { ...timing, slowLoadWindowMs: 150 },
      async () => true
    ).startFlight(payload);
    expect(result).toMatchObject({ success: false, reason: 'connection_lost' });
  });
});
