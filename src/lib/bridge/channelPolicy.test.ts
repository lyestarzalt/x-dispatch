import { describe, expect, it } from 'vitest';
import { collectChannels } from './apiSurface';
import {
  DESKTOP_ONLY_CHANNELS,
  REMOTE_ALLOWED_CHANNELS,
  REMOTE_LOCAL_CHANNELS,
  isRemoteAllowed,
} from './channelPolicy';

describe('channel policy', () => {
  it('classifies every channel of the surface exactly once', () => {
    const { invoke, send } = collectChannels();
    const surface = [...invoke, ...send].sort();
    const classified = [
      ...REMOTE_ALLOWED_CHANNELS,
      ...DESKTOP_ONLY_CHANNELS,
      ...REMOTE_LOCAL_CHANNELS,
    ].sort();
    expect(classified).toEqual(surface);
  });

  it('keeps file, dialog and database channels on the desktop', () => {
    for (const ch of [
      'debug:dbExec',
      'xplane:browseForPath',
      'app:pickDirectory',
      'addon:scenery:delete',
      'remote:setEnabled',
    ]) {
      expect(isRemoteAllowed(ch)).toBe(false);
    }
    expect(isRemoteAllowed('launcher:launch')).toBe(true);
    expect(isRemoteAllowed('app:openExternal')).toBe(false);
  });
});
