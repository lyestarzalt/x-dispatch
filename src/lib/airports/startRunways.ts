import type { Helipad, Runway, WaterRunway } from '@/types/apt';
import { RunwayMarking, ShoulderSurfaceType, SurfaceType } from '@/types/apt';

type StartLists = { runways: Runway[]; waterRunways: WaterRunway[] };

/**
 * A water lane presented as a runway, so the start picker, the end markers
 * and the deep links treat it like any other runway. Markings and lights
 * are off: there are none on water.
 */
function waterAsRunway(lane: WaterRunway, fallbackRow: number): Runway {
  const end = (e: WaterRunway['ends'][0]) => ({
    name: e.name,
    latitude: e.latitude,
    longitude: e.longitude,
    dthr_length: 0,
    overrun_length: 0,
    marking: RunwayMarking.NONE,
    lighting: 0,
    tdz_lighting: false,
    reil: 0,
  });
  return {
    width: lane.width,
    surface_type: SurfaceType.WATER_RUNWAY,
    shoulder_surface_type: ShoulderSurfaceType.NONE,
    shoulder_width: 0,
    smoothness: 0,
    centerline_lights: false,
    edge_lights: false,
    auto_distance_remaining_signs: false,
    ends: [end(lane.ends[0]), end(lane.ends[1])],
    startRow: lane.startRow ?? fallbackRow,
  };
}

/**
 * Every runway a flight can start on: land runways first, then water lanes.
 * Each carries its X-Plane start row; files without one recorded fall back
 * to this list order, which is the usual apt.dat layout.
 */
export function startRunways(airport: StartLists): Runway[] {
  const land = airport.runways.map((r, i) => ({ ...r, startRow: r.startRow ?? i }));
  const water = (airport.waterRunways ?? []).map((lane, i) =>
    waterAsRunway(lane, airport.runways.length + i)
  );
  return [...land, ...water];
}

/** X-Plane start row of a helipad: recorded by the parser, else after every runway. */
export function helipadStartRow(helipad: Helipad, index: number, airport: StartLists): number {
  return helipad.startRow ?? airport.runways.length + (airport.waterRunways?.length ?? 0) + index;
}
