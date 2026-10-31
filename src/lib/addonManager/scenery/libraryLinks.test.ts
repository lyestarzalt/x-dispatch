import { describe, expect, it } from 'vitest';
import { libraryLink } from './libraryLinks';

describe('libraryLink', () => {
  it('knows the home of common libraries, whatever the folder case', () => {
    expect(libraryLink('MisterX_Library')).toEqual({
      name: 'MisterX Library',
      url: 'https://forums.x-plane.org/files/file/28167-misterx-library-and-static-aircraft-extension/',
      known: true,
    });
    expect(libraryLink('OpenSceneryX').known).toBe(true);
    expect(libraryLink('openSAM_Library').name).toBe('openSAM');
    expect(libraryLink('RA_Library').url).toContain('45410-ra-library');
    expect(libraryLink('ff_library').url).toContain('12708-fflibrary');
  });

  it('falls back to an X-Plane.org download search for the exact name', () => {
    expect(libraryLink('R2_Library')).toEqual({
      name: 'R2_Library',
      url: 'https://forums.x-plane.org/index.php?/search/&q=R2_Library&type=downloads_file',
      known: false,
    });
    expect(libraryLink('ruscenery').known).toBe(false);
    expect(libraryLink('3D people library').url).toContain('q=3D%20people%20library');
  });
});
