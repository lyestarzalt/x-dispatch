import type { Aircraft } from '@/types/aircraft';

/**
 * Who made the add-on, from the .acf studio field, cleaned of the trailing commas some
 * authors leave and dropped when it only repeats the manufacturer.
 */
export function aircraftStudio(aircraft: Pick<Aircraft, 'studio' | 'manufacturer'>): string {
  const studio = aircraft.studio.replace(/[\s,]+$/, '').trim();
  if (!studio || studio.toLowerCase() === aircraft.manufacturer.toLowerCase()) return '';
  return studio;
}
