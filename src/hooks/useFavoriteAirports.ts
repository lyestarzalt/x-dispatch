import { useMemo } from 'react';
import { useAirportsListQuery } from '@/queries/useAirportsListQuery';
import { useSettingsStore } from '@/stores/settingsStore';

export interface FavoriteAirport {
  icao: string;
  /** Null when the current nav data no longer has the airport. */
  name: string | null;
  isHome: boolean;
}

/**
 * Home first, then the favorites in the order they were starred. Home and
 * favorites are separate settings; a home that is also a favorite is listed
 * once, at its favorite place.
 */
export function orderFavoriteAirports(
  favoriteIcaos: readonly string[],
  homeIcao: string | null,
  nameByIcao: ReadonlyMap<string, string>
): FavoriteAirport[] {
  const ordered: string[] = [];
  if (homeIcao && !favoriteIcaos.includes(homeIcao)) ordered.push(homeIcao);
  ordered.push(...favoriteIcaos);
  return ordered.map((icao) => ({
    icao,
    name: nameByIcao.get(icao) ?? null,
    isHome: icao === homeIcao,
  }));
}

/** The home airport and the favorites with their names, as the settings and the airport panel list them. */
export function useFavoriteAirports(): FavoriteAirport[] {
  const favoriteIcaos = useSettingsStore((s) => s.airports.favoriteIcaos);
  const homeIcao = useSettingsStore((s) => s.airports.homeIcao);
  const { data: airports } = useAirportsListQuery();
  return useMemo(
    () =>
      orderFavoriteAirports(
        favoriteIcaos,
        homeIcao,
        new Map(airports?.map((a) => [a.icao, a.name]) ?? [])
      ),
    [airports, favoriteIcaos, homeIcao]
  );
}
