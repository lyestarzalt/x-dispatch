import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';

vi.mock('electron', () => ({
  app: { getPath: () => userData },
}));
vi.mock('@/lib/utils/logger', () => ({
  default: { main: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

const { getAnalyticsConsent, getInstallations, isSetupComplete, saveAnalyticsPendingSession } =
  await import('./config');

const configPath = () => path.join(userData, 'config.json');

function writeConfig(config: object | string) {
  fs.writeFileSync(
    configPath(),
    typeof config === 'string' ? config : JSON.stringify(config, null, 2),
    'utf-8'
  );
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
}

const SESSION = { durationSeconds: 60, endedAt: '2026-10-08T00:00:00.000Z', appVersion: '2.3.1' };

describe('config persistence', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-config-'));
  });

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('keeps installations and consent when the X-Plane folder is missing (unplugged drive)', () => {
    const missing = path.join(userData, 'unplugged', 'X-Plane 12');
    writeConfig({
      xplanePath: missing,
      version: 1,
      lastUpdated: '2026-01-01T00:00:00.000Z',
      installations: [{ id: 'a', name: 'Main', path: missing }],
      activeInstallationId: 'a',
      analyticsConsent: 'granted',
      analyticsInstallId: 'install-1',
    });

    // The quit handler saves the session; this must not erase the rest.
    saveAnalyticsPendingSession(SESSION);

    const saved = readConfig();
    expect(saved.xplanePath).toBe(missing);
    expect(saved.installations).toEqual([{ id: 'a', name: 'Main', path: missing }]);
    expect(saved.activeInstallationId).toBe('a');
    expect(saved.analyticsConsent).toBe('granted');
    expect(saved.analyticsPendingSession).toEqual(SESSION);
  });

  it('still reads stored settings while the X-Plane folder is missing', () => {
    const missing = path.join(userData, 'unplugged', 'X-Plane 12');
    writeConfig({
      xplanePath: missing,
      version: 1,
      lastUpdated: '2026-01-01T00:00:00.000Z',
      installations: [{ id: 'a', name: 'Main', path: missing }],
      analyticsConsent: 'denied',
    });

    expect(isSetupComplete()).toBe(false);
    expect(getInstallations()).toHaveLength(1);
    expect(getAnalyticsConsent()).toBe('denied');
  });

  it('backs up an unreadable config instead of silently overwriting it', () => {
    writeConfig('{"xplanePath": "/x", "installations": [');

    saveAnalyticsPendingSession(SESSION);

    const backups = fs.readdirSync(userData).filter((f) => f.startsWith('config.json.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(userData, backups[0]!), 'utf-8')).toContain('installations');
    expect(readConfig().analyticsPendingSession).toEqual(SESSION);
  });

  it('writes atomically, leaving no temp file behind', () => {
    saveAnalyticsPendingSession(SESSION);
    expect(fs.readdirSync(userData)).toEqual(['config.json']);
  });
});
