import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXCLUDED_PATTERNS, RECOGNIZED_PATTERNS, parseLog } from './parseLog';

const fixture = readFileSync(resolve(__dirname, '__fixtures__/success-log-snippet.txt'), 'utf8');

describe('parseLog', () => {
  it('recognises the FLT init success line in a real log fixture', () => {
    const result = parseLog(fixture);
    expect(result.recognized).toHaveLength(1);
    expect(result.recognized[0]?.id).toBe('flt-init-ok');
    expect(result.recognized[0]?.line).toContain("type:'ramp_start'");
  });

  it('excludes known noise (lost controllers, override warning, analytics download)', () => {
    const result = parseLog(fixture);
    const otherText = result.otherIssues.map((m) => m.line).join('\n');
    expect(otherText).not.toContain('lost some controllers');
    expect(otherText).not.toContain('overrides code');
    expect(otherText).not.toContain('analytics.html');
  });

  it('surfaces remaining E/W lines that are neither recognised nor excluded', () => {
    const result = parseLog(fixture);
    expect(result.otherIssues.map((m) => m.category)).toEqual(
      expect.arrayContaining(['APT', 'TEX'])
    );
  });

  it('reports lineCount equal to the number of input lines', () => {
    const result = parseLog(fixture);
    expect(result.lineCount).toBe(fixture.split('\n').length);
  });

  it('handles empty input', () => {
    expect(parseLog('')).toEqual({ recognized: [], otherIssues: [], lineCount: 1 });
  });

  it('surfaces nested-category E/W lines (e.g. W/GFX/MTL) with top-level category', () => {
    const text = '0:00:00.000 W/GFX/MTL: Some shader warning\n';
    const result = parseLog(text);
    expect(result.otherIssues).toHaveLength(1);
    expect(result.otherIssues[0]?.category).toBe('GFX');
    expect(result.otherIssues[0]?.level).toBe('warn');
  });
});

describe('RECOGNIZED_PATTERNS regex', () => {
  it('flt-init-ok matches ramp_start init', () => {
    const p = RECOGNIZED_PATTERNS.find((x) => x.id === 'flt-init-ok')!;
    expect(
      p.regex.test("0:00:06.355 I/FLT: Init dat_p0 type:'ramp_start' apt:DAAG start at:C 9")
    ).toBe(true);
  });

  it('flt-init-ok matches runway_start init', () => {
    const p = RECOGNIZED_PATTERNS.find((x) => x.id === 'flt-init-ok')!;
    expect(
      p.regex.test("0:00:06.355 I/FLT: Init dat_p0 type:'runway_start' apt:LFPG start at:08L")
    ).toBe(true);
  });

  it('flt-init-ok matches lle_* init', () => {
    const p = RECOGNIZED_PATTERNS.find((x) => x.id === 'flt-init-ok')!;
    expect(
      p.regex.test("0:00:06.355 I/FLT: Init dat_p0 type:'lle_ground_start' apt:KJFK start at:1")
    ).toBe(true);
  });

  it('flt-init-ok does not match unrelated I/FLT lines', () => {
    const p = RECOGNIZED_PATTERNS.find((x) => x.id === 'flt-init-ok')!;
    expect(p.regex.test('0:00:06.355 I/FLT: Some other status message')).toBe(false);
  });
});

describe('EXCLUDED_PATTERNS regex', () => {
  it('apt-lost-controllers matches the noisy controller error', () => {
    const p = EXCLUDED_PATTERNS.find((x) => x.id === 'apt-lost-controllers')!;
    expect(
      p.regex.test(
        '0:00:00.000 E/APT: The airport ETOU has lost some controllers due to bad frequencies.'
      )
    ).toBe(true);
  });

  it('apt-override-warning matches override conflicts', () => {
    const p = EXCLUDED_PATTERNS.find((x) => x.id === 'apt-override-warning')!;
    expect(
      p.regex.test(
        '0:00:00.000 W/APT: WARNING: airport Hubbard (ID TA49) overrides code 25TX but it has already been overridden by Chennault Airfield (ID XK00BR)'
      )
    ).toBe(true);
  });

  it('net-analytics-failed matches the analytics download failure', () => {
    const p = EXCLUDED_PATTERNS.find((x) => x.id === 'net-analytics-failed')!;
    expect(
      p.regex.test(
        '0:02:36.052 E/NET: Download failed with error: 28 for URL https://lookup.x-plane.com/_lookup_12_/analytics.html (IP: 18.161.111.109)'
      )
    ).toBe(true);
  });

  it('does not match unrelated network errors', () => {
    const p = EXCLUDED_PATTERNS.find((x) => x.id === 'net-analytics-failed')!;
    expect(
      p.regex.test(
        '0:02:36.052 E/NET: Download failed with error: 28 for URL https://example.com/something'
      )
    ).toBe(false);
  });
});
