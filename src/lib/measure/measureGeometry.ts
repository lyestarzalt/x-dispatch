import { magneticVariation } from '@/lib/magvar';
import { type NauticalMiles, calculateBearing, distanceNm } from '@/lib/utils/geomath';
import type { MeasureLine, MeasurePoint } from '@/stores/measureStore';
import { finalBearing } from './geodesic';
import type { MeasureGeometry, MeasureSnap } from './measureLabel';

export interface MeasureLegs {
  legs: MeasureGeometry[];
  totalNm: NauticalMiles;
}

function legGeometry(
  from: MeasurePoint,
  to: MeasurePoint,
  snap: MeasureSnap | null
): MeasureGeometry {
  // A VOR that publishes its own variation wins over the model at both ends of
  // its leg, so the radial and the courses agree with the station.
  const station = snap?.kind === 'vor' ? snap.magneticVariation : undefined;
  return {
    initialTrue: calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude),
    finalTrue: finalBearing(from.latitude, from.longitude, to.latitude, to.longitude),
    distanceNm: distanceNm(from.latitude, from.longitude, to.latitude, to.longitude),
    startVariation: station ?? magneticVariation(from.latitude, from.longitude),
    endVariation: station ?? magneticVariation(to.latitude, to.longitude),
    snap,
  };
}

/** One geometry per leg of the line; the anchor applies to the first leg only. */
export function measureLegs(line: MeasureLine): MeasureLegs {
  const legs: MeasureGeometry[] = [];
  let total = 0;
  for (let i = 1; i < line.points.length; i++) {
    const from = line.points[i - 1];
    const to = line.points[i];
    if (!from || !to) continue;
    const leg = legGeometry(from, to, i === 1 ? line.snap : null);
    total += leg.distanceNm;
    legs.push(leg);
  }
  return { legs, totalNm: total as NauticalMiles };
}
