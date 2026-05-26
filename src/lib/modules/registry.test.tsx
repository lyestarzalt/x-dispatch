import { describe, expect, it } from 'vitest';
import { getAirportModuleTabs, isModuleActive } from './registry';

describe('modules registry', () => {
  it('checks module enabled state', () => {
    expect(
      isModuleActive(
        [
          {
            manifest: {
              id: 'sia-france',
              name: 'SIA',
              version: '1.0.0',
              kind: 'bundled',
            },
            state: {
              id: 'sia-france',
              enabled: true,
              source: 'bundled',
              installedAt: new Date().toISOString(),
              trusted: true,
            },
          },
        ],
        'sia-france'
      )
    ).toBe(true);
    expect(isModuleActive([], 'sia-france')).toBe(false);
  });

  it('shows VAC tab for any aerodrome when module is active', () => {
    const enabled = [
      {
        manifest: {
          id: 'sia-france',
          name: 'SIA',
          version: '1.1.0',
          kind: 'bundled' as const,
          contributions: { settingsTabs: [{ tabId: 'sia-france', labelKey: 'modules.siaFrance.settingsTab' }] },
        },
        state: {
          id: 'sia-france',
          enabled: true,
          source: 'bundled' as const,
          installedAt: new Date().toISOString(),
          trusted: true,
        },
      },
    ];
    const vac = getAirportModuleTabs(enabled).find((tab) => tab.id === 'vac');
    expect(vac).toBeDefined();
    expect(vac?.isVisible({ id: 'LFPO', metadata: { country: 'FRA' } } as never)).toBe(true);
    expect(vac?.isVisible({ id: 'EGLL', metadata: { country: 'GBR' } } as never)).toBe(true);
  });
});
