import { useQuery } from '@tanstack/react-query';

export const distinctCountriesKey = ['data', 'distinctCountries'] as const;

export function useDistinctCountries() {
  return useQuery({
    queryKey: distinctCountriesKey,
    queryFn: () => window.airportAPI.getDistinctCountries(),
    staleTime: Infinity,
  });
}
