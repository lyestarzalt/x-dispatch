import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';

/**
 * Takes the plan off the map and returns how to put it back exactly as it was. A plan that came
 * from the planner also goes on its list of previous plans, so it outlives the undo toast.
 */
export function clearPlanFromMap(): () => void {
  const map = useFlightPlanStore.getState();
  const builder = usePlanBuilderStore.getState();
  const snapshot = {
    fmsData: map.fmsData,
    fileName: map.fileName,
    isEnriching: map.isEnriching,
    simbriefData: map.simbriefData,
    selectedWaypointIndex: map.selectedWaypointIndex,
    showFlightPlanBar: map.showFlightPlanBar,
    departure: map.departure,
    arrival: map.arrival,
    route: map.route,
  };
  const procedure = useAppStore.getState().selectedProcedure;
  const fromPlanner =
    !map.simbriefData &&
    builder.departure !== null &&
    builder.arrival !== null &&
    map.fileName === `${builder.departure.icao}-${builder.arrival.icao}`;
  if (fromPlanner) builder.rememberPlan();
  map.clearFlightPlan();
  return () => {
    useFlightPlanStore.setState(snapshot);
    useAppStore.getState().selectProcedure(procedure);
  };
}
