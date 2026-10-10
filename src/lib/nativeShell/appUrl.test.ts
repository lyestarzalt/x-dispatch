import { describe, expect, it } from 'vitest';
import { describeRemoteUrl, findAppUrlInArgv, parseAppUrl, remoteFileUrlOf } from './appUrl';

describe('parseAppUrl', () => {
  describe('airport', () => {
    it('reads the ICAO from the path and upper-cases it', () => {
      expect(parseAppUrl('xdispatch://airport/daag')).toEqual({ kind: 'airport', icao: 'DAAG' });
    });

    it('accepts the ICAO as a query parameter too', () => {
      expect(parseAppUrl('xdispatch://airport?icao=LFPG')).toEqual({
        kind: 'airport',
        icao: 'LFPG',
      });
    });

    it('carries a panel tab and a runway when valid', () => {
      expect(parseAppUrl('xdispatch://airport/DAAG?tab=start&rwy=23')).toEqual({
        kind: 'airport',
        icao: 'DAAG',
        tab: 'start',
        runway: '23',
      });
      expect(parseAppUrl('xdispatch://airport/EGLL?rwy=27l')).toMatchObject({ runway: '27L' });
    });

    it('drops an unknown tab or runway but keeps the airport', () => {
      expect(parseAppUrl('xdispatch://airport/DAAG?tab=weather&rwy=99')).toEqual({
        kind: 'airport',
        icao: 'DAAG',
      });
    });

    it('rejects an invalid ICAO', () => {
      expect(parseAppUrl('xdispatch://airport/')).toBeNull();
      expect(parseAppUrl('xdispatch://airport/D')).toBeNull();
      expect(parseAppUrl('xdispatch://airport/TOO-LONG-ID')).toBeNull();
      expect(parseAppUrl('xdispatch://airport/<script>')).toBeNull();
    });

    it('accepts the longer IDs custom scenery uses', () => {
      expect(parseAppUrl('xdispatch://airport/XLFPG01')).toMatchObject({ icao: 'XLFPG01' });
    });
  });

  describe('route', () => {
    it('reads from, to and a normalised route string', () => {
      expect(
        parseAppUrl('xdispatch://route?from=daag&to=lfpg&via=sugol%20ul620%20%20kekix')
      ).toEqual({ kind: 'route', from: 'DAAG', to: 'LFPG', via: 'SUGOL UL620 KEKIX' });
    });

    it('works with only a route string', () => {
      expect(parseAppUrl('xdispatch://route?via=DCT')).toEqual({ kind: 'route', via: 'DCT' });
    });

    it('rejects a route with nothing usable', () => {
      expect(parseAppUrl('xdispatch://route')).toBeNull();
      expect(parseAppUrl('xdispatch://route?from=!&via=%3Cb%3E')).toBeNull();
    });
  });

  describe('simbrief', () => {
    it('opens with no pilot id', () => {
      expect(parseAppUrl('xdispatch://simbrief')).toEqual({ kind: 'simbrief' });
    });

    it('carries a numeric pilot id', () => {
      expect(parseAppUrl('xdispatch://simbrief?user=123456')).toEqual({
        kind: 'simbrief',
        pilotId: '123456',
      });
    });

    it('carries a SimBrief username too', () => {
      expect(parseAppUrl('xdispatch://simbrief?user=bob.smith')).toEqual({
        kind: 'simbrief',
        pilotId: 'bob.smith',
      });
    });

    it('rejects a user SimBrief could not accept instead of ignoring it', () => {
      expect(parseAppUrl('xdispatch://simbrief?user=bob%20smith')).toBeNull();
      expect(parseAppUrl('xdispatch://simbrief?user=%3Cscript%3E')).toBeNull();
    });
  });

  describe('import', () => {
    it('accepts an https file URL', () => {
      expect(parseAppUrl('xdispatch://import?url=https%3A%2F%2Fexample.com%2Fplan.fms')).toEqual({
        kind: 'import-url',
        url: 'https://example.com/plan.fms',
      });
    });

    it('rejects http, file, credentials and missing URLs', () => {
      expect(parseAppUrl('xdispatch://import?url=http%3A%2F%2Fexample.com%2Fplan.fms')).toBeNull();
      expect(parseAppUrl('xdispatch://import?url=file%3A%2F%2F%2Fetc%2Fpasswd')).toBeNull();
      expect(
        parseAppUrl('xdispatch://import?url=https%3A%2F%2Fuser%3Apw%40example.com%2Fa.fms')
      ).toBeNull();
      expect(parseAppUrl('xdispatch://import')).toBeNull();
    });
  });

  describe('launch', () => {
    it('carries airport and aircraft name', () => {
      expect(
        parseAppUrl('xdispatch://launch?airport=daag&aircraft=Cessna%20172%20(G1000)')
      ).toEqual({ kind: 'launch', icao: 'DAAG', aircraft: 'Cessna 172 (G1000)' });
    });

    it('opens the dialog with nothing preselected when both are invalid', () => {
      expect(parseAppUrl('xdispatch://launch?airport=!!&aircraft=%3Cscript%3E')).toEqual({
        kind: 'launch',
      });
    });
  });

  describe('settings, logs, update, addon', () => {
    it('reads a settings tab from the path', () => {
      expect(parseAppUrl('xdispatch://settings/about')).toEqual({ kind: 'settings', tab: 'about' });
      expect(parseAppUrl('xdispatch://settings/Companion-Apps')).toEqual({
        kind: 'settings',
        tab: 'companion-apps',
      });
    });

    it('opens settings on the default tab when the tab is unknown', () => {
      expect(parseAppUrl('xdispatch://settings/nope')).toEqual({ kind: 'settings' });
      expect(parseAppUrl('xdispatch://settings')).toEqual({ kind: 'settings' });
    });

    it('reads logs and update', () => {
      expect(parseAppUrl('xdispatch://logs')).toEqual({ kind: 'logs' });
      expect(parseAppUrl('xdispatch://update')).toEqual({ kind: 'update' });
    });

    it('reads the addon manager tab', () => {
      expect(parseAppUrl('xdispatch://addon?tab=installer')).toEqual({
        kind: 'addon',
        tab: 'installer',
      });
      expect(parseAppUrl('xdispatch://addon/scenery')).toEqual({ kind: 'addon', tab: 'scenery' });
      expect(parseAppUrl('xdispatch://addon')).toEqual({ kind: 'addon' });
    });

    it('never produces an install action, whatever the URL says', () => {
      expect(
        parseAppUrl('xdispatch://addon/install?url=https%3A%2F%2Fevil.example%2Fx.zip')
      ).toEqual({ kind: 'addon' });
    });
  });

  describe('source', () => {
    it('keeps a known source and drops an unknown one', () => {
      expect(parseAppUrl('xdispatch://logs?src=website')).toEqual({
        kind: 'logs',
        source: 'website',
      });
      expect(parseAppUrl('xdispatch://logs?src=evil')).toEqual({ kind: 'logs' });
    });
  });

  describe('rejections', () => {
    it('ignores other schemes and unknown hosts', () => {
      expect(parseAppUrl('https://x-dispatch.app/airport/DAAG')).toBeNull();
      expect(parseAppUrl('xdispatch://nope/DAAG')).toBeNull();
      expect(parseAppUrl('xdispatch:airport')).toBeNull();
    });

    it('ignores garbage and oversized input', () => {
      expect(parseAppUrl('')).toBeNull();
      expect(parseAppUrl('not a url')).toBeNull();
      expect(parseAppUrl(`xdispatch://airport/DAAG?x=${'a'.repeat(3000)}`)).toBeNull();
    });
  });
});

describe('findAppUrlInArgv', () => {
  it('returns the first valid app URL among launcher and Chromium arguments', () => {
    const argv = [
      '/Applications/X-Dispatch.app/Contents/MacOS/x-dispatch',
      '--allow-file-access-from-files',
      'xdispatch://airport/DAAG?src=discord',
    ];
    expect(findAppUrlInArgv(argv)).toBe('xdispatch://airport/DAAG?src=discord');
  });

  it('skips tokens that look like the scheme but do not parse', () => {
    expect(findAppUrlInArgv(['x-dispatch', 'xdispatch://nope', 'xdispatch://logs'])).toBe(
      'xdispatch://logs'
    );
  });

  it('returns null without an app URL', () => {
    expect(findAppUrlInArgv(['x-dispatch', '--reset-cache'])).toBeNull();
  });
});

describe('remoteFileUrlOf', () => {
  it('normalises and keeps https URLs only', () => {
    expect(remoteFileUrlOf('https://Example.com/a.fms')).toBe('https://example.com/a.fms');
    expect(remoteFileUrlOf('ftp://example.com/a.fms')).toBeUndefined();
    expect(remoteFileUrlOf(`https://example.com/${'a'.repeat(1100)}`)).toBeUndefined();
  });
});

describe('describeRemoteUrl', () => {
  it('splits host and path for a dialog', () => {
    expect(describeRemoteUrl('https://example.com/plans/a.fms')).toEqual({
      host: 'example.com',
      path: '/plans/a.fms',
    });
  });
});
