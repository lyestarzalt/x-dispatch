/**
 * Tests for nav data source and AIRAC cycle detection.
 *
 * Focus areas:
 *  - AIRAC calendar math (cycle id → effective/expiration dates)
 *  - the provider comes from the earth_nav.dat header free text, never from
 *    cycle.json (XPNavData ships one with the exact same shape as Navigraph)
 *  - Custom Data without any known provider (convert424toxplane output) is
 *    'custom' with the cycle read from the file header
 *  - Stock installs report the cycle from the default nav file header
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectAllDataSources,
  getAiracCycleDates,
  parseDataCycleHeader,
  parseProviderFromHeader,
} from './cycleInfo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let TEMP_ROOT: string;

// Header shapes as the providers actually ship them
const NAVIGRAPH_BRAND = 'Copyright (c) 2025 Navigraph, Datasource Jeppesen';
const XPNAVDATA_BRAND = 'XPNavData - 2610';

const NAV_HEADER = (cycle: string, brand = 'Copyright') =>
  `I\n1200 Version - data cycle ${cycle}, build 20260826, metadata NavXP1200. ${brand}\n`;

function makeStockInstall(cycle = '2406'): string {
  const root = fs.mkdtempSync(path.join(TEMP_ROOT, 'install-'));
  const defaultData = path.join(root, 'Resources', 'default data');
  fs.mkdirSync(path.join(defaultData, 'airspaces'), { recursive: true });
  fs.writeFileSync(path.join(defaultData, 'earth_nav.dat'), NAV_HEADER(cycle));
  fs.writeFileSync(path.join(defaultData, 'earth_fix.dat'), 'fix');
  fs.writeFileSync(path.join(defaultData, 'earth_awy.dat'), 'awy');
  fs.writeFileSync(path.join(defaultData, 'airspaces', 'airspace.txt'), 'airspace');
  return root;
}

function addCustomData(root: string, cycle: string, brand?: string) {
  const customData = path.join(root, 'Custom Data');
  fs.mkdirSync(path.join(customData, 'CIFP'), { recursive: true });
  fs.writeFileSync(path.join(customData, 'earth_nav.dat'), NAV_HEADER(cycle, brand));
  fs.writeFileSync(path.join(customData, 'earth_fix.dat'), 'fix');
  fs.writeFileSync(path.join(customData, 'earth_awy.dat'), 'awy');
}

function addCycleJson(root: string, json: string) {
  fs.writeFileSync(path.join(root, 'Custom Data', 'cycle.json'), json);
}

beforeEach(() => {
  TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-cycleinfo-test-'));
});

afterEach(() => {
  if (fs.existsSync(TEMP_ROOT)) {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseDataCycleHeader', () => {
  it('reads the cycle out of a stock nav data header', () => {
    expect(
      parseDataCycleHeader(
        'I\n1200 Version - data cycle 2406, build 20251002, metadata NavXP1200. Copyright'
      )
    ).toBe('2406');
  });

  it('gives null when the header has no cycle', () => {
    expect(parseDataCycleHeader('I\n1100 Version')).toBeNull();
  });
});

describe('getAiracCycleDates', () => {
  it('matches published effective dates', () => {
    // Real-world anchors: 2501 = 23 Jan 2025, 2601 = 22 Jan 2026,
    // 2609 = 3 Sep 2026 (per Navigraph's own validity metadata).
    expect(getAiracCycleDates('2501')?.effectiveDate.toISOString()).toBe(
      '2025-01-23T00:00:00.000Z'
    );
    expect(getAiracCycleDates('2601')?.effectiveDate.toISOString()).toBe(
      '2026-01-22T00:00:00.000Z'
    );
    expect(getAiracCycleDates('2609')?.effectiveDate.toISOString()).toBe(
      '2026-09-03T00:00:00.000Z'
    );
  });

  it('sets expiration exactly 28 days after the effective date', () => {
    const dates = getAiracCycleDates('2609');
    expect(dates?.expirationDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('computes the last cycle of a 13-cycle year', () => {
    expect(getAiracCycleDates('2513')?.effectiveDate.toISOString()).toBe(
      '2025-12-25T00:00:00.000Z'
    );
  });

  it('rejects ordinals that do not exist in the given year', () => {
    // 2025 has 13 cycles; cycle 14 would start in 2026.
    expect(getAiracCycleDates('2514')).toBeNull();
  });

  it('rejects malformed cycle identifiers', () => {
    expect(getAiracCycleDates(null)).toBeNull();
    expect(getAiracCycleDates('')).toBeNull();
    expect(getAiracCycleDates('26')).toBeNull();
    expect(getAiracCycleDates('26099')).toBeNull();
    expect(getAiracCycleDates('abcd')).toBeNull();
    expect(getAiracCycleDates('2600')).toBeNull();
    expect(getAiracCycleDates('2615')).toBeNull();
  });
});

describe('parseProviderFromHeader', () => {
  it('names known providers from the header free text', () => {
    expect(parseProviderFromHeader(NAV_HEADER('2609', NAVIGRAPH_BRAND))).toBe('Navigraph');
    expect(parseProviderFromHeader(NAV_HEADER('2610', XPNAVDATA_BRAND))).toBe('XPNavData');
    expect(parseProviderFromHeader(NAV_HEADER('2609'))).toBeNull();
  });
});

describe('detectAllDataSources', () => {
  it('reports a Navigraph install from its branded header plus cycle.json', () => {
    const root = makeStockInstall('2406');
    addCustomData(root, '2609', NAVIGRAPH_BRAND);
    addCycleJson(root, '{"cycle":"2609","revision":"1","name":"X-Plane 12"}');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('navigraph');
    expect(sources.global.provider).toBe('Navigraph');
    expect(sources.global.cycle).toBe('2609');
    expect(sources.global.revision).toBe('1');
    expect(sources.global.isCustomData).toBe(true);
    expect(sources.global.effectiveDate?.toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(sources.global.expirationDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(sources.navaids.source).toBe('navigraph');
    expect(sources.waypoints.source).toBe('navigraph');
    expect(sources.procedures.source).toBe('navigraph');
  });

  it('reports XPNavData as custom with its provider name, despite the Navigraph-shaped cycle.json', () => {
    const root = makeStockInstall('2406');
    addCustomData(root, '2610', XPNAVDATA_BRAND);
    addCycleJson(root, '{"cycle":"2610","revision":"1","name":"X-Plane 12"}');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('custom');
    expect(sources.global.provider).toBe('XPNavData');
    expect(sources.global.cycle).toBe('2610');
    expect(sources.global.revision).toBe('1');
    expect(sources.navaids.provider).toBe('XPNavData');
  });

  it('reports converted custom data (no cycle.json) with the header cycle', () => {
    const root = makeStockInstall('2406');
    addCustomData(root, '2609');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('custom');
    expect(sources.global.provider).toBeNull();
    expect(sources.global.cycle).toBe('2609');
    expect(sources.global.isCustomData).toBe(true);
    expect(sources.global.effectiveDate?.toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(sources.navaids.source).toBe('custom');
    expect(sources.waypoints.source).toBe('custom');
  });

  it('falls back to custom without a cycle when the header is unreadable', () => {
    const root = makeStockInstall('2406');
    addCustomData(root, '2609');
    fs.writeFileSync(path.join(root, 'Custom Data', 'earth_nav.dat'), 'no header here');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('custom');
    expect(sources.global.cycle).toBeNull();
    expect(sources.global.isExpired).toBe(false);
  });

  it('ignores a malformed cycle.json and still reports the custom layer', () => {
    const root = makeStockInstall('2406');
    addCustomData(root, '2609');
    addCycleJson(root, '{not json');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('custom');
    expect(sources.global.cycle).toBe('2609');
  });

  it('reports stock data with the cycle from the default nav header', () => {
    const root = makeStockInstall('2406');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('xplane-default');
    expect(sources.global.cycle).toBe('2406');
    expect(sources.global.isCustomData).toBe(false);
    expect(sources.global.isExpired).toBe(false);
    expect(sources.navaids.source).toBe('xplane-default');
  });

  it('flags an expired custom cycle', () => {
    const root = makeStockInstall('2406');
    // Cycle 2501 expired 20 Feb 2025 — long past for any realistic test run.
    addCustomData(root, '2501', NAVIGRAPH_BRAND);
    addCycleJson(root, '{"cycle":"2501","revision":"1","name":"X-Plane 12"}');

    const sources = detectAllDataSources(root);

    expect(sources.global.source).toBe('navigraph');
    expect(sources.global.isExpired).toBe(true);
  });
});
