import type { XDispatchModuleManifest } from '@/lib/modules/types';

export const siaFranceManifest: XDispatchModuleManifest = {
  id: 'sia-france',
  name: 'VAC Charts',
  version: '1.1.0',
  description: 'VAC chart import, integrated preview, and map overlay for aerodromes worldwide',
  author: '4SLSL community',
  minAppVersion: '1.9.1',
  kind: 'bundled',
  defaultEnabled: false,
  contributions: {
    settingsSections: [{ sectionId: 'sia-charts', tabId: 'sia-france' }],
    airportTabs: [{ tabId: 'vac' }],
    toolbarToggles: [{ toggleId: 'vac-overlay' }],
    mapHooks: [{ hookId: 'vac-overlay' }],
    protocols: [{ scheme: 'vac-pdf' }],
  },
};
