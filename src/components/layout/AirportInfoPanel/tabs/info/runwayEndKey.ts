import { normalizeRunwayName } from '@/lib/flightplan/builder/runways';

/**
 * Join key for a runway end across data sources. apt.dat writes single-digit
 * ends bare ("6", "9"), earth_nav.dat and ATIS text write them padded ("06",
 * "09"); matched raw, KACK's ILS 06 and KMIA's ILS 09 never found their runway.
 * Falls back to the upper-cased name for anything that is not a runway end.
 */
export function runwayEndKey(name: string): string {
  return normalizeRunwayName(name) ?? name.trim().toUpperCase();
}
