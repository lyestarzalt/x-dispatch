import { describe, expect, it } from 'vitest';
import { airportModuleTabs, isModuleActive } from './registry';

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
              kind: 'core',
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

  it('keeps VAC tab scoped to french airports', () => {
    const vac = airportModuleTabs.find((tab) => tab.id === 'vac');
    expect(vac).toBeDefined();
    expect(
      vac?.isVisible({
        id: 'LFPO',
        metadata: { country: 'FRA France' },
      } as never)
    ).toBe(true);
    expect(
      vac?.isVisible({
        id: 'KJFK',
        metadata: { country: 'USA' },
      } as never)
    ).toBe(false);
  });
});
