/**
 * Main-process warnings and errors reach Sentry Logs, so a slow step that
 * throws nothing (the 2.9.0 startup scan logged its own duration) is visible
 * per release and platform without a user report.
 */
import { describe, expect, it } from 'vitest';
import { createLogForwarder, sentryLogFor } from './logForwarding';

describe('sentryLogFor', () => {
  it('forwards warnings and errors with the logger scope as an attribute', () => {
    expect(sentryLogFor('warn', ['[Data] ATC: 950 lines skipped'])).toEqual({
      level: 'warn',
      message: 'ATC: 950 lines skipped',
      attributes: { scope: 'data' },
    });
    expect(
      sentryLogFor('error', ['[Main] Custom scenery resync failed', new Error('EACCES')])
    ).toEqual({
      level: 'error',
      message: 'Custom scenery resync failed',
      attributes: { scope: 'main', error: 'EACCES' },
    });
  });

  it('keeps the detail string of a renderer line', () => {
    expect(
      sentryLogFor('error', ['[Renderer] MapLibre error [source: raster]', 'Failed to fetch'])
        ?.attributes.error
    ).toBe('Failed to fetch');
  });

  it('hides the account name in the message and the error', () => {
    expect(
      sentryLogFor('warn', [
        '[Renderer Console] slow (file:///C:/Users/rolan/AppData/Local/XDispatch/app.asar/a.js:5)',
        new Error("EPERM: open '/Users/ron/x.db'"),
      ])
    ).toEqual({
      level: 'warn',
      message:
        '[Renderer Console] slow (file:///C:/Users/<user>/AppData/Local/XDispatch/app.asar/a.js:5)',
      attributes: { scope: 'default', error: "EPERM: open '/Users/<user>/x.db'" },
    });
  });

  it('leaves info and debug lines in the local log only', () => {
    expect(sentryLogFor('info', ['[Data] Loaded 3035 ATC controllers'])).toBeNull();
    expect(sentryLogFor('debug', ['[Renderer Console] x'])).toBeNull();
  });

  it('keeps a line without a scope prefix as is', () => {
    expect(sentryLogFor('warn', ['Sentry skipped at startup'])).toEqual({
      level: 'warn',
      message: 'Sentry skipped at startup',
      attributes: { scope: 'default' },
    });
  });
});

describe('createLogForwarder', () => {
  it('sends a repeated warning once per session', async () => {
    const { createLogForwarder } = await import('./logForwarding');
    const next = createLogForwarder();
    expect(
      next('warn', ['[Data] ATC: 950 lines skipped. controller NADZAB lacks a name'])
    ).not.toBeNull();
    expect(
      next('warn', ['[Data] ATC: 950 lines skipped. controller NADZAB lacks a name'])
    ).toBeNull();
    expect(next('warn', ['[Data] something else'])).not.toBeNull();
  });

  it('stops after the per-session cap and says so once', async () => {
    const { createLogForwarder, MAX_FORWARDED_PER_SESSION } = await import('./logForwarding');
    const next = createLogForwarder();
    for (let i = 0; i < MAX_FORWARDED_PER_SESSION; i++) {
      expect(next('warn', [`[Main] warning ${i}`])).not.toBeNull();
    }
    const last = next('warn', ['[Main] one too many']);
    expect(last?.message).toMatch(/forwarding paused/i);
    expect(next('error', ['[Main] after the cap', new Error('x')])).toBeNull();
  });

  it('trims a long message to a bounded length', async () => {
    const { createLogForwarder, MAX_FORWARDED_LENGTH } = await import('./logForwarding');
    const next = createLogForwarder();
    const entry = next('warn', ['[Data] ' + 'x'.repeat(5_000)]);
    expect(entry?.message.length).toBe(MAX_FORWARDED_LENGTH);
  });
});

describe('basemap console warnings', () => {
  it('stay in the local log: the map style raises them, not our code', () => {
    const forward = createLogForwarder();
    for (const line of [
      '[Renderer Console] Image "circle-11" could not be loaded. Please make sure you have added the image before it is needed with map.addImage()',
      '[Renderer Console] layers[road_shield_us].filter[1]: Expected value to be of type number, but found null instead. Falling back to false.',
      '[Renderer Console] Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true.',
    ]) {
      expect(forward('warn', [line])).toBeNull();
    }
    expect(forward('warn', ['[Renderer Console] something of ours'])).not.toBeNull();
  });
});
