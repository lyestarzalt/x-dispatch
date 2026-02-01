export { QueryProvider, queryClient } from './QueryProvider';
export { useAirportQuery, useAirportProceduresQuery, airportKeys } from './useAirportQuery';
export type { Procedure, ProcedureWaypoint, AirportProcedures } from './useAirportQuery';

export {
  useNavDataQuery,
  useGlobalAirspacesQuery,
  getNavDataCounts,
  navDataKeys,
} from './useNavDataQuery';
export type { NavigationData, Navaid, Waypoint, Airspace } from './useNavDataQuery';

export { useWeatherQuery, useMetarQuery, useTafQuery, weatherKeys } from './useWeatherQuery';
export type { WeatherData } from './useWeatherQuery';

export {
  useVatsimQuery,
  getPilotsInBounds,
  getPilotsNearAirport,
  getControllersForAirport,
  getATISForAirport,
  vatsimKeys,
} from './useVatsimQuery';
export type { VatsimData, VatsimPilot, VatsimController, VatsimATIS } from './useVatsimQuery';

export {
  useGatewayQuery,
  getRecommendedScenery,
  formatGatewayDate,
  gatewayKeys,
} from './useGatewayQuery';
export type { GatewayAirport, GatewayScenery } from './useGatewayQuery';
