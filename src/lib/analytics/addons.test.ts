import { describe, expect, it } from 'vitest';
import { addonTypeId } from './addons';
import { sanitizeEvent } from './events';

describe('addonTypeId', () => {
  it('maps every installer type to an id the allowlist accepts', () => {
    expect(addonTypeId('Aircraft')).toBe('aircraft');
    expect(addonTypeId('SceneryLibrary')).toBe('scenery_library');
    expect(addonTypeId('LuaScript')).toBe('lua_script');
    for (const type of [
      'Aircraft',
      'SceneryLibrary',
      'Scenery',
      'Navdata',
      'Plugin',
      'Livery',
      'LuaScript',
    ] as const) {
      expect(
        sanitizeEvent('addon_installed', { type: addonTypeId(type), success: true })
      ).not.toBeNull();
    }
  });
});
