import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternal = vi.fn();

beforeEach(() => {
  openExternal.mockReset();
  openExternal.mockResolvedValue({ success: true });
  vi.stubGlobal('window', {
    appAPI: {
      openExternal,
    },
  });
});

describe('openSettingsExternalLink', () => {
  it('routes settings links through appAPI.openExternal', async () => {
    const { openSettingsExternalLink } = await import('./externalLinks');

    await openSettingsExternalLink('https://example.com');

    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });
});
