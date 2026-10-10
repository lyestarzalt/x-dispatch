import { useMemo } from 'react';
import {
  VerticalProfileChart,
  type VerticalProfileRow,
} from '@/components/profile/VerticalProfileChart';
import type { SimBriefOFP } from '@/types/simbrief';

interface VerticalProfileProps {
  data: SimBriefOFP;
  className?: string;
}

/**
 * The SimBrief navlog's own planned altitudes and terrain, in the shared profile chart.
 * The navlog starts at the first fix (often the top of climb) and ends on a fix whose altitude
 * is the approach platform, so the departure airport is added at 0 NM and the arrival is
 * brought down to field elevation: the line then climbs out of one airport and lands at the
 * other, like a built plan's.
 */
export function VerticalProfile({ data, className }: VerticalProfileProps) {
  const { rows, tocDistance, todDistance } = useMemo(() => {
    const { origin, destination, navlog: fixes } = data;
    const airportRow = (airport: SimBriefOFP['origin'], distance: number): VerticalProfileRow => {
      const elevation = Math.max(parseInt(airport.elevation, 10) || 0, 0);
      return {
        distance,
        latitude: parseFloat(airport.pos_lat),
        longitude: parseFloat(airport.pos_long),
        altitude: elevation,
        groundHeight: elevation,
        ident: airport.icao_code,
      };
    };

    let cumulative = 0;
    let toc: number | null = null;
    let tod: number | null = null;
    const rows: VerticalProfileRow[] = [airportRow(origin, 0)];
    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      if (!fix) continue;
      cumulative += parseFloat(fix.distance) || 0;
      if (fix.type === 'apt' && fix.ident === destination.icao_code) continue;
      const next = fixes[i + 1];
      const isTopOfClimb = fix.stage === 'CLB' && next?.stage === 'CRZ';
      const isTopOfDescent = fix.stage === 'CRZ' && next?.stage === 'DSC';
      if (isTopOfClimb) toc = cumulative;
      if (isTopOfDescent) tod = cumulative;
      rows.push({
        distance: Math.round(cumulative),
        latitude: parseFloat(fix.pos_lat),
        longitude: parseFloat(fix.pos_long),
        altitude: parseInt(fix.altitude_feet, 10) || 0,
        groundHeight: Math.max(parseInt(fix.ground_height, 10) || 0, 0),
        ident: fix.ident,
        isTopOfClimb,
        isTopOfDescent,
        wind: `${fix.wind_dir}°/${fix.wind_spd}kt`,
        oat: `${fix.oat}°C`,
      });
    }
    const total = Math.max(cumulative, parseFloat(data.general.route_distance) || 0);
    rows.push(airportRow(destination, Math.round(total)));
    return { rows, tocDistance: toc, todDistance: tod };
  }, [data]);

  return (
    <VerticalProfileChart
      rows={rows}
      tocDistance={tocDistance}
      todDistance={todDistance}
      className={className}
    />
  );
}
