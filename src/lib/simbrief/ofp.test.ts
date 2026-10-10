import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/ofp-v2.json';
import {
  isSimbriefUser,
  listOf,
  parseDurationSeconds,
  parseOfpResponse,
  parseTimestamp,
  primaryAlternate,
  simbriefFetchUrl,
  slimOfp,
  text,
} from './ofp';

const ok = (body: unknown) => ({ data: JSON.stringify(body), error: null, statusCode: 200 });

describe('simbriefFetchUrl', () => {
  it('sends digits as a Pilot ID and anything else as a username', () => {
    expect(simbriefFetchUrl('1234567')).toBe(
      'https://www.simbrief.com/api/xml.fetcher.php?userid=1234567&json=v2'
    );
    expect(simbriefFetchUrl(' bob.smith ')).toBe(
      'https://www.simbrief.com/api/xml.fetcher.php?username=bob.smith&json=v2'
    );
  });

  it('escapes the user', () => {
    expect(simbriefFetchUrl('a&b')).toContain('username=a%26b');
  });
});

describe('isSimbriefUser', () => {
  it('accepts Pilot IDs and aliases, rejects spaces and markup', () => {
    expect(isSimbriefUser('1274029')).toBe(true);
    expect(isSimbriefUser('NavigatorX')).toBe(true);
    expect(isSimbriefUser('bob smith')).toBe(false);
    expect(isSimbriefUser('<script>')).toBe(false);
    expect(isSimbriefUser('')).toBe(false);
  });
});

describe('parseOfpResponse', () => {
  it('returns the trimmed plan on success', () => {
    const result = parseOfpResponse(ok(fixture));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.origin.icao_code).toBe('OTHH');
    expect(result.data.navlog).toHaveLength(fixture.navlog.length);
    expect(result.data.params.airac).toBe('2610');
  });

  it('maps an unknown user (HTTP 400) to a code', () => {
    const body = { fetch: { userid: '', static_id: '', status: 'Error: Unknown UserID' } };
    expect(
      parseOfpResponse({ data: JSON.stringify(body), error: 'HTTP 400', statusCode: 400 })
    ).toEqual({ success: false, code: 'unknown_user', error: 'Unknown UserID' });
  });

  it('maps a user with no plan on file to a code', () => {
    const body = { fetch: { status: 'Error: No flight plan on file for the specified user' } };
    const result = parseOfpResponse({ data: JSON.stringify(body), error: 'HTTP 400' });
    expect(result).toMatchObject({ success: false, code: 'no_plan' });
  });

  it('reports a network failure', () => {
    expect(parseOfpResponse({ data: null, error: 'Timeout after 15000ms' })).toEqual({
      success: false,
      code: 'network',
      error: 'Timeout after 15000ms',
    });
  });

  it('reports an HTML error page as a bad response', () => {
    const result = parseOfpResponse({
      data: '<html>502</html>',
      error: 'HTTP 502',
      statusCode: 502,
    });
    expect(result).toMatchObject({ success: false, code: 'bad_response' });
  });

  it('rejects a success body without a navlog', () => {
    const result = parseOfpResponse(ok({ fetch: { status: 'Success' }, origin: {} }));
    expect(result).toMatchObject({ success: false, code: 'bad_response' });
  });
});

describe('slimOfp', () => {
  it('drops the sections the app never reads', () => {
    const raw = { ...fixture, notams: [{}], text: { plan_html: 'x' }, images: {}, crew: {} };
    const slim = slimOfp(raw) as unknown as Record<string, unknown>;
    expect(slim).not.toHaveProperty('notams');
    expect(slim).not.toHaveProperty('text');
    expect(slim).not.toHaveProperty('images');
    expect(slim).not.toHaveProperty('crew');
    expect(slim.fms_downloads).toBe(fixture.fms_downloads);
  });

  it('keeps every list an array, including the legacy single-object and placeholder shapes', () => {
    const legacy = {
      ...fixture,
      navlog: { fix: fixture.navlog[0] },
      alternate: fixture.alternate[0],
      sigmets: { sigmet: fixture.sigmets[0] },
      origin: { ...fixture.origin, notam: {} },
      tlr: {
        takeoff: { ...fixture.tlr.takeoff, runway: fixture.tlr.takeoff.runway[0] },
        landing: { ...fixture.tlr.landing, runway: {} },
      },
    };
    const slim = slimOfp(legacy);
    expect(slim.navlog).toEqual([fixture.navlog[0]]);
    expect(slim.alternate.map((a) => a.icao_code)).toEqual(['KPHL']);
    expect(slim.sigmets).toHaveLength(1);
    expect(slim.origin.notam).toEqual([]);
    expect(slim.tlr?.takeoff.runway).toHaveLength(1);
    expect(slim.tlr?.landing.runway).toEqual([]);
  });

  it('turns an empty navlog placeholder into an empty array instead of dropping it', () => {
    const slim = slimOfp({ ...fixture, navlog: {} });
    expect(slim.navlog).toEqual([]);
  });

  it('reads a missing SIGMET qualifier as an empty string', () => {
    const slim = slimOfp({ ...fixture, sigmets: [{ ...fixture.sigmets[0], qualifier: [] }] });
    expect(slim.sigmets[0]?.qualifier).toBe('');
  });
});

describe('listOf', () => {
  it('handles arrays, objects, placeholders and nesting', () => {
    expect(listOf([1, 2])).toEqual([1, 2]);
    expect(listOf({ a: 1 })).toEqual([{ a: 1 }]);
    expect(listOf({})).toEqual([]);
    expect(listOf(undefined)).toEqual([]);
    expect(listOf('')).toEqual([]);
    expect(listOf({ fix: [{ a: 1 }] }, 'fix')).toEqual([{ a: 1 }]);
    expect(listOf({ fix: { a: 1 } }, 'fix')).toEqual([{ a: 1 }]);
  });
});

describe('text', () => {
  it('returns strings and numbers, and empties for the v2 placeholders', () => {
    expect(text('SEV')).toBe('SEV');
    expect(text(12)).toBe('12');
    expect(text([])).toBe('');
    expect(text(false)).toBe('');
    expect(text(undefined)).toBe('');
  });
});

describe('primaryAlternate', () => {
  it('is the first alternate, or undefined when there is none', () => {
    expect(primaryAlternate(slimOfp(fixture))?.icao_code).toBe('KPHL');
    expect(primaryAlternate(slimOfp({ ...fixture, alternate: [] }))).toBeUndefined();
  });
});

describe('parseDurationSeconds', () => {
  it('reads v2 clock strings and legacy seconds', () => {
    expect(parseDurationSeconds('13:17:31')).toBe(47851);
    expect(parseDurationSeconds('00:02:34')).toBe(154);
    expect(parseDurationSeconds('1:05')).toBe(3900);
    expect(parseDurationSeconds('47851')).toBe(47851);
    expect(parseDurationSeconds(154)).toBe(154);
  });

  it('is null for empty or unreadable values', () => {
    expect(parseDurationSeconds('')).toBeNull();
    expect(parseDurationSeconds(undefined)).toBeNull();
    expect(parseDurationSeconds('soon')).toBeNull();
  });
});

describe('parseTimestamp', () => {
  it('reads ISO 8601 and epoch seconds', () => {
    expect(parseTimestamp('2026-10-10T05:55:00Z')?.toISOString()).toBe('2026-10-10T05:55:00.000Z');
    expect(parseTimestamp('1791611700')?.toISOString()).toBe('2026-10-10T05:55:00.000Z');
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('never')).toBeNull();
  });
});
