import type { XDispatchModuleManifest } from '@/lib/modules/types';

export const siaFranceManifest: XDispatchModuleManifest = {
  id: 'sia-france',
  name: 'SIA France Charts',
  version: '1.0.0',
  description: 'VAC/eAIP integration and OACI overlays for LF airports',
  author: '4SLSL community',
  minAppVersion: '1.8.4',
  kind: 'bundled',
  defaultEnabled: false,
  contributions: {
    settingsSections: [{ sectionId: 'sia-charts', tabId: 'graphics' }],
    airportTabs: [{ tabId: 'vac', when: { icaoPrefix: 'LF' } }],
    toolbarToggles: [
      { toggleId: 'vac-overlay' },
      { toggleId: 'oaci-basemap' },
      { toggleId: 'oaci-vector' },
    ],
    mapHooks: [{ hookId: 'vac-overlay' }, { hookId: 'oaci-basemap' }, { hookId: 'oaci-vector' }],
    protocols: [{ scheme: 'vac-pdf' }],
  },
};
