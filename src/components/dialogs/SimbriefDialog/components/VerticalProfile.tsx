import { useMemo } from 'react';
import {
  VerticalProfileChart,
  type VerticalProfileRow,
} from '@/components/profile/VerticalProfileChart';
import type { SimBriefFix } from '@/types/simbrief';

interface VerticalProfileProps {
  fixes: SimBriefFix[];
  className?: string;
}

/** The SimBrief navlog's own planned altitudes and terrain, in the shared profile chart. */
export function VerticalProfile({ fixes, className }: VerticalProfileProps) {
  const { rows, tocDistance, todDistance } = useMemo(() => {
    let cumulative = 0;
    let toc: number | null = null;
    let tod: number | null = null;
    const rows: VerticalProfileRow[] = [];
    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      if (!fix) continue;
      cumulative += parseFloat(fix.distance) || 0;
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
    return { rows, tocDistance: toc, todDistance: tod };
  }, [fixes]);

  return (
    <VerticalProfileChart
      rows={rows}
      tocDistance={tocDistance}
      todDistance={todDistance}
      className={className}
    />
  );
}
