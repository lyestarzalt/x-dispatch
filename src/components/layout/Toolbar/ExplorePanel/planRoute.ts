import { toEndpoint } from '@/components/dialogs/FlightPlanBuilder/AirportPicker';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';

/**
 * Hands a city pair to the plan builder and opens it. False when either airport is
 * not in X-Plane's database, in which case the planner is left untouched.
 */
export function openPlannerForRoute(airports: Airport[], from: string, to: string): boolean {
  const departure = airports.find((a) => a.icao === from);
  const arrival = airports.find((a) => a.icao === to);
  if (!departure || !arrival) return false;

  const builder = usePlanBuilderStore.getState();
  builder.setDeparture(toEndpoint(departure));
  builder.setArrival(toEndpoint(arrival));
  builder.open();
  return true;
}
