import type { RangeRingCategory } from '@/types/layers';
import type { AircraftCategory } from '@/types/xplane';

/** The planning class (speeds, climb gradients) for the aircraft the sim reports. */
export function planningClass(category: AircraftCategory | null | undefined): RangeRingCategory {
  switch (category) {
    case 'ga':
    case 'glider':
    case 'ultralight':
    case 'seaplane':
    case 'helicopter':
    case 'vtol':
      return 'prop';
    default:
      return 'jet';
  }
}
