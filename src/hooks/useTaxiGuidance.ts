import { useMemo, useState } from 'react';
import { type TrackedGuidance, createGuidanceTracker } from '@/lib/taxiGuidance';
import { usePlaneStore } from '@/stores/planeStore';
import { guidanceRoutes, useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';

/**
 * Where the aircraft is on its planned taxi route and what comes next, or null
 * when it isn't on the ground near one. Each window keeps its own tracker.
 */
export function useTaxiGuidance(): TrackedGuidance | null {
  const plane = usePlaneStore((s) => s.state);
  const departure = useTaxiGuidanceStore((s) => s.departure);
  const arrival = useTaxiGuidanceStore((s) => s.arrival);
  const [tracker] = useState(createGuidanceTracker);

  return useMemo(() => {
    if (!plane || plane.onGround !== true) return null;
    return tracker.update(guidanceRoutes({ departure, arrival }), {
      lat: plane.latitude,
      lon: plane.longitude,
    });
  }, [plane, departure, arrival, tracker]);
}
