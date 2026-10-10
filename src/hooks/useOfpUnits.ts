import { useMemo } from 'react';
import { kgToLbs } from '@/lib/utils/format';
import { useUnits } from './useUnits';

/**
 * Unit formatters for a SimBrief OFP. SimBrief writes fuel and weights in whatever the pilot
 * chose on simbrief.com (`params.units`, "lbs" or "kgs"); this converts them to the app's
 * canonical pounds and then to the unit chosen in Settings, so the briefing reads in the same
 * units as the rest of X-Dispatch. Distances, altitudes and speeds come through `useUnits`
 * unchanged, since SimBrief publishes those in the canonical units already.
 */
export function useOfpUnits(apiUnit: string) {
  const units = useUnits();
  return useMemo(() => {
    const toLbs = (value: string | number): number | null => {
      const n = typeof value === 'number' ? value : parseFloat(value);
      if (!Number.isFinite(n)) return null;
      return apiUnit === 'kgs' ? kgToLbs(n) : n;
    };
    return {
      ...units,
      /** "4,054 kg" or "8,938 lbs": a fuel or weight figure from the OFP, exact. */
      ofpWeight: (value: string | number): string => {
        const lbs = toLbs(value);
        return lbs === null ? '—' : units.weightExact(lbs);
      },
      /** The same figure as a number in the display unit, for bars and compact readouts. */
      ofpWeightF: (value: string | number): number | null => {
        const lbs = toLbs(value);
        return lbs === null ? null : units.weightF(lbs);
      },
    };
  }, [apiUnit, units]);
}
