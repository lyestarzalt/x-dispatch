import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternalLink } from './openExternal';

const URL = 'https://aeronav.faa.gov/d-tpp/2612/00582IL16C.PDF';

afterEach(() => vi.unstubAllGlobals());

describe('openExternalLink', () => {
  it('hands the address to the system browser on the PC', () => {
    const openExternal = vi.fn(async () => ({ success: true }));
    const open = vi.fn();
    vi.stubGlobal('window', { appAPI: { isRemoteClient: false, openExternal }, open });
    openExternalLink(URL);
    expect(openExternal).toHaveBeenCalledWith(URL);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens a new tab on a tablet, where the PC would refuse the request', () => {
    const openExternal = vi.fn();
    const open = vi.fn();
    vi.stubGlobal('window', { appAPI: { isRemoteClient: true, openExternal }, open });
    openExternalLink(URL);
    expect(open).toHaveBeenCalledWith(URL, '_blank', 'noopener,noreferrer');
    expect(openExternal).not.toHaveBeenCalled();
  });
});
