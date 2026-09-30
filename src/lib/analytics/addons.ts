import type { AddonType } from '@/lib/addonManager/installer/types';
import type { AnalyticsAddonType } from './events';

const ADDON_TYPE_IDS: Record<AddonType, AnalyticsAddonType> = {
  Aircraft: 'aircraft',
  SceneryLibrary: 'scenery_library',
  Scenery: 'scenery',
  Navdata: 'navdata',
  Plugin: 'plugin',
  Livery: 'livery',
  LuaScript: 'lua_script',
};

/** The installer's add-on type as reported, e.g. SceneryLibrary → scenery_library. */
export function addonTypeId(type: AddonType): AnalyticsAddonType {
  return ADDON_TYPE_IDS[type];
}
