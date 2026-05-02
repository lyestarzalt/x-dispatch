/**
 * Tests for X-Plane version detection.
 *
 * Two halves:
 *   1. Pure parsing — `parseVersionString` and `isVersionAtLeast`. These run
 *      every startup and gate feature flags ("requires X-Plane 12.4+"); a
 *      regression here silently breaks compatibility checks.
 *   2. Strategy fallback — `detectXPlaneVersion` cascades through the
 *      `--version` flag, then `Log.txt` parsing, then macOS Info.plist. We
 *      exercise the Log.txt branch with real temp files because the Windows
 *      Steam case actively *requires* this fallback (running the exe pops a
 *      Steam dialog).
 *
 * Steam-vs-standalone detection is asserted via the resulting `isSteam` flag
 * because `isSteamInstallation` is private. That's intentional — testing
 * through the public surface keeps the tests honest.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' },
}));

vi.mock('@/lib/utils/logger', () => {
  const noop = () => {};
  const channel = { info: noop, warn: noop, error: noop, debug: noop };
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      main: channel,
      data: channel,
      ipc: channel,
      security: channel,
      launcher: channel,
      tracker: channel,
      addon: channel,
    },
    getLogPath: () => '/tmp/test.log',
  };
});

const { detectXPlaneVersion, isVersionAtLeast, parseVersionString } =
  await import('./versionDetector');
type XPlaneVersionInfo = import('./versionDetector').XPlaneVersionInfo;

// ---------------------------------------------------------------------------
// parseVersionString
// ---------------------------------------------------------------------------

describe('parseVersionString', () => {
  it('parses the canonical release format "12.4.0-r2-9b69b91a"', () => {
    const v = parseVersionString('12.4.0-r2-9b69b91a');
    expect(v).toEqual({
      raw: '12.4.0-r2-9b69b91a',
      major: 12,
      minor: 4,
      patch: 0,
      channel: 'release',
      channelBuild: 2,
      commit: '9b69b91a',
    });
  });

  it('parses beta versions ("12.5.0-b1-...")', () => {
    const v = parseVersionString('12.5.0-b1-abc123');
    expect(v?.channel).toBe('beta');
    expect(v?.channelBuild).toBe(1);
  });

  it('parses early-access versions ("12.6.0-ec3-...")', () => {
    const v = parseVersionString('12.6.0-ec3-def456');
    expect(v?.channel).toBe('ec');
    expect(v?.channelBuild).toBe(3);
  });

  it('parses bare versions without channel/commit ("12.4.0")', () => {
    const v = parseVersionString('12.4.0');
    expect(v?.major).toBe(12);
    expect(v?.minor).toBe(4);
    expect(v?.patch).toBe(0);
    expect(v?.channel).toBe('unknown');
    expect(v?.channelBuild).toBe(0);
    expect(v?.commit).toBe('');
  });

  it('strips surrounding whitespace before matching', () => {
    const v = parseVersionString('  12.4.0-r2-9b69b91a\n');
    expect(v?.raw).toBe('12.4.0-r2-9b69b91a');
    expect(v?.major).toBe(12);
  });

  it('returns null for malformed strings', () => {
    expect(parseVersionString('')).toBeNull();
    expect(parseVersionString('not-a-version')).toBeNull();
    expect(parseVersionString('12.4')).toBeNull(); // missing patch
    expect(parseVersionString('X-Plane 12.4.0')).toBeNull(); // prefix not stripped
  });

  it('treats unrecognised channel keys as "unknown" without crashing', () => {
    // The regex only matches r/b/ec; anything else makes the regex fail,
    // returning null. This test guards against a future change that might
    // accept other channel keys but mishandle them.
    expect(parseVersionString('12.4.0-x9-abc123')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isVersionAtLeast
// ---------------------------------------------------------------------------

describe('isVersionAtLeast', () => {
  function v(major: number, minor: number, patch: number): XPlaneVersionInfo {
    return {
      raw: `${major}.${minor}.${patch}`,
      major,
      minor,
      patch,
      channel: 'release',
      channelBuild: 0,
      commit: '',
      isSteam: false,
    };
  }

  it('returns true for an exact match (patch comparison is >=, inclusive)', () => {
    expect(isVersionAtLeast(v(12, 4, 5), 12, 4, 5)).toBe(true);
  });

  it('returns true when newer patch is installed', () => {
    expect(isVersionAtLeast(v(12, 4, 6), 12, 4, 5)).toBe(true);
  });

  it('returns false when older patch is installed', () => {
    expect(isVersionAtLeast(v(12, 4, 4), 12, 4, 5)).toBe(false);
  });

  it('returns true when newer minor compensates for older patch', () => {
    expect(isVersionAtLeast(v(12, 5, 0), 12, 4, 99)).toBe(true);
  });

  it('returns true when newer major compensates for older minor', () => {
    expect(isVersionAtLeast(v(13, 0, 0), 12, 99, 99)).toBe(true);
  });

  it('returns false when older major is installed', () => {
    expect(isVersionAtLeast(v(11, 99, 99), 12, 0, 0)).toBe(false);
  });

  it('matches the "X-Plane 12.4+" gating used in production', () => {
    // The app advertises "Requires X-Plane 12.4+" — make sure that gate works.
    expect(isVersionAtLeast(v(12, 4, 0), 12, 4, 0)).toBe(true);
    expect(isVersionAtLeast(v(12, 3, 99), 12, 4, 0)).toBe(false);
    expect(isVersionAtLeast(v(12, 4, 1), 12, 4, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectXPlaneVersion (Log.txt fallback path, with real fs)
// ---------------------------------------------------------------------------

describe('detectXPlaneVersion via Log.txt fallback', () => {
  let TEMP_ROOT: string;

  beforeEach(() => {
    TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-version-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(TEMP_ROOT)) {
      fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  it('extracts the version from the first line of Log.txt when --version is unavailable', async () => {
    // No X-Plane executable in the temp dir, so runVersionCommand fails fast.
    fs.writeFileSync(
      path.join(TEMP_ROOT, 'Log.txt'),
      'Log.txt for X-Plane 12.4.0-r2-9b69b91a (build 124210 macOS 64-bit, Vulkan 1.3.250)\n' +
        'Compiled on Apr  4 2026 12:34:56\n'
    );

    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result).not.toBeNull();
    expect(result?.major).toBe(12);
    expect(result?.minor).toBe(4);
    expect(result?.patch).toBe(0);
    expect(result?.channel).toBe('release');
  });

  it('only reads the first line — content after is ignored', async () => {
    fs.writeFileSync(
      path.join(TEMP_ROOT, 'Log.txt'),
      'Log.txt for X-Plane 12.4.0-r2-aaaabbbb\nLater garbage with X-Plane 99.0.0 in it\n'
    );

    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result?.major).toBe(12);
    expect(result?.minor).toBe(4);
  });

  it('returns null when Log.txt does not exist and --version is unavailable', async () => {
    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result).toBeNull();
  });

  it('returns null when Log.txt exists but the first line has no recognisable version', async () => {
    fs.writeFileSync(path.join(TEMP_ROOT, 'Log.txt'), 'Garbage first line\n');
    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result).toBeNull();
  });

  it('handles binary garbage in Log.txt without crashing', async () => {
    fs.writeFileSync(path.join(TEMP_ROOT, 'Log.txt'), Buffer.from([0xff, 0x00, 0xfe, 0x00]));
    // Should not throw, just return null
    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result).toBeNull();
  });

  it('reports isSteam=true when the install path contains "steamapps"', async () => {
    // Steam-style path under temp dir
    const steamRoot = path.join(TEMP_ROOT, 'steamapps', 'common', 'X-Plane 12');
    fs.mkdirSync(steamRoot, { recursive: true });
    fs.writeFileSync(
      path.join(steamRoot, 'Log.txt'),
      'Log.txt for X-Plane 12.4.0-r2-9b69b91a (build 124210)\n'
    );

    const result = await detectXPlaneVersion(steamRoot);
    expect(result?.isSteam).toBe(true);
  });

  it('reports isSteam=true when steam_appid.txt is present (case where path lacks steamapps)', async () => {
    fs.writeFileSync(path.join(TEMP_ROOT, 'steam_appid.txt'), '2014780');
    fs.writeFileSync(
      path.join(TEMP_ROOT, 'Log.txt'),
      'Log.txt for X-Plane 12.4.0-r2-9b69b91a (build 124210)\n'
    );

    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result?.isSteam).toBe(true);
  });

  it('reports isSteam=false for a standalone install', async () => {
    fs.writeFileSync(
      path.join(TEMP_ROOT, 'Log.txt'),
      'Log.txt for X-Plane 12.4.0-r2-9b69b91a (build 124210)\n'
    );

    const result = await detectXPlaneVersion(TEMP_ROOT);
    expect(result?.isSteam).toBe(false);
  });
});
