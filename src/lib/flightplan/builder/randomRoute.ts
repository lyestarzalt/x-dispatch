/**
 * Random destinations from an origin: land airports inside a distance band,
 * optionally narrowed by country, custom scenery, live weather and online ATC.
 * The eligibility rules mirror suggestAlternate.
 */
import type { WeatherCategory } from '@/lib/weatherScan/parseMetarFeed';
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { RangeRingCategory } from '@/types/layers';
import { estimateMinutes, greatCircleNm } from './geometry';

export type RouteScope = 'any' | 'domestic' | 'international';

export interface RandomRouteCriteria {
  minNm: number;
  maxNm: number;
  category: RangeRingCategory;
  scope: RouteScope;
  customOnly: boolean;
  /** Any of these categories in the destination METAR; empty means no weather filter. */
  weather: WeatherCategory[];
  atcOnly: boolean;
}

export interface RandomRouteContext {
  weatherByIcao?: Map<string, WeatherCategory[]>;
  /** Callsign prefixes (ICAO or IATA) with a controller or ATIS online. */
  staffedPrefixes?: Set<string>;
}

export interface RandomRoute {
  airport: Airport;
  distanceNm: number;
  minutes: number;
  weather: WeatherCategory[];
  staffed: boolean;
}

export const DEFAULT_RANDOM_ROUTE_COUNT = 5;

function isStaffed(airport: Airport, prefixes: Set<string> | undefined): boolean {
  if (!prefixes) return false;
  if (prefixes.has(airport.icao.toUpperCase())) return true;
  return !!airport.iataCode && prefixes.has(airport.iataCode.toUpperCase());
}

export function findRandomRoutes(
  airports: Airport[],
  origin: Airport,
  criteria: RandomRouteCriteria,
  context: RandomRouteContext = {},
  count: number = DEFAULT_RANDOM_ROUTE_COUNT,
  random: () => number = Math.random
): RandomRoute[] {
  const from = { latitude: origin.lat, longitude: origin.lon };
  const matches: RandomRoute[] = [];

  for (const a of airports) {
    if (a.type !== 'land' || a.icao === origin.icao || a.runwayCount < 1) continue;
    if (criteria.category !== 'prop' && a.surfaceType !== 'paved') continue;
    if (criteria.customOnly && !a.isCustom) continue;
    if (criteria.scope === 'domestic' && a.country !== origin.country) continue;
    if (criteria.scope === 'international' && a.country === origin.country) continue;

    const distanceNm = greatCircleNm(from, { latitude: a.lat, longitude: a.lon });
    if (distanceNm < criteria.minNm || distanceNm > criteria.maxNm) continue;

    const weather = context.weatherByIcao?.get(a.icao.toUpperCase()) ?? [];
    if (criteria.weather.length > 0 && !weather.some((w) => criteria.weather.includes(w))) {
      continue;
    }

    const staffed = isStaffed(a, context.staffedPrefixes);
    if (criteria.atcOnly && !staffed) continue;

    matches.push({
      airport: a,
      distanceNm,
      minutes: estimateMinutes(distanceNm, criteria.category),
      weather,
      staffed,
    });
  }

  // Partial Fisher-Yates: the first `count` slots end up a uniform sample.
  const picks = Math.min(count, matches.length);
  for (let i = 0; i < picks; i++) {
    const j = i + Math.floor(random() * (matches.length - i));
    [matches[i], matches[j]] = [matches[j] as RandomRoute, matches[i] as RandomRoute];
  }
  return matches.slice(0, picks).sort((a, b) => a.distanceNm - b.distanceNm);
}
