export { QueryProvider } from './QueryProvider';

// X-Plane API hooks (REST via IPC)
export {
  useXPlaneStatus,
  useXPlaneCapabilities,
  useDataref,
  useSetDataref,
  useActivateCommand,
  useStartFlight,
  xplaneKeys,
  type FlightInit,
} from './useXPlaneQuery';

// X-Plane WebSocket hooks (live streaming)
export { usePlaneState, usePlanePosition, usePlaneStateManual } from './useXPlaneWebSocket';

// Nav data hooks
export { useNavDataQuery, useGlobalAirwaysQuery, getNavDataCounts } from './useNavDataQuery';

// VATSIM hooks
export { useVatsimQuery } from './useVatsimQuery';
export { useVatsimMetarQuery } from './useVatsimMetarQuery';
export { useVatsimEventsQuery } from './useVatsimEventsQuery';

// App data hooks
export {
  useAppVersion,
  useXPlanePath,
  useLoadingStatus,
  useAirportMetadata,
  useATCControllers,
  useAirportProcedures,
  appKeys,
} from './useAppQuery';
