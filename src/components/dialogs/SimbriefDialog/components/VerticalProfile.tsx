import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { SimBriefFix } from '@/types/simbrief';

interface VerticalProfileProps {
  fixes: SimBriefFix[];
  className?: string;
}

interface ProfileDataPoint {
  distance: number;
  altitude: number;
  groundHeight: number;
  ident: string;
  stage: string;
  wind: string;
  oat: string;
  isTopOfClimb: boolean;
  isTopOfDescent: boolean;
}

const chartConfig = {
  altitude: {
    label: 'Altitude',
    color: 'oklch(var(--primary))',
  },
  groundHeight: {
    label: 'Terrain',
    color: 'oklch(var(--muted-foreground))',
  },
} satisfies ChartConfig;

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ProfileDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (!entry) return null;
  const point = entry.payload;
  if (!point?.ident) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono font-semibold">{point.ident}</span>
        {point.isTopOfClimb && (
          <Badge variant="success" className="text-[10px]">
            T/C
          </Badge>
        )}
        {point.isTopOfDescent && (
          <Badge variant="warning" className="text-[10px]">
            T/D
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Altitude</span>
        <span className="text-right font-mono">
          {point.altitude >= 10000
            ? `FL${Math.round(point.altitude / 100)}`
            : `${point.altitude.toLocaleString()} ft`}
        </span>
        <span className="text-muted-foreground">Distance</span>
        <span className="text-right font-mono">{point.distance} nm</span>
        <span className="text-muted-foreground">Wind</span>
        <span className="text-right font-mono">{point.wind}</span>
        <span className="text-muted-foreground">OAT</span>
        <span className="text-right font-mono">{point.oat}</span>
        <span className="text-muted-foreground">Terrain</span>
        <span className="text-right font-mono">{point.groundHeight.toLocaleString()} ft</span>
      </div>
    </div>
  );
}

export function VerticalProfile({ fixes, className }: VerticalProfileProps) {
  const { data, tocDistance, todDistance, maxAltitude } = useMemo(() => {
    if (!fixes || fixes.length < 2) {
      return { data: [], tocDistance: null, todDistance: null, maxAltitude: 40000 };
    }

    let cumulativeDistance = 0;
    let tocDist: number | null = null;
    let todDist: number | null = null;
    const points: ProfileDataPoint[] = [];

    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      if (!fix) continue;
      const legDistance = parseFloat(fix.distance) || 0;
      cumulativeDistance += legDistance;

      const altitude = parseInt(fix.altitude_feet, 10) || 0;
      const groundHeight = parseInt(fix.ground_height, 10) || 0;
      const nextFix = fixes[i + 1];

      // Detect TOC: climbing and next fix is cruise
      const isTopOfClimb = fix.stage === 'CLB' && nextFix?.stage === 'CRZ';
      // Detect TOD: cruise and next fix is descent
      const isTopOfDescent = fix.stage === 'CRZ' && nextFix?.stage === 'DSC';

      if (isTopOfClimb) tocDist = cumulativeDistance;
      if (isTopOfDescent) todDist = cumulativeDistance;

      points.push({
        distance: Math.round(cumulativeDistance),
        altitude,
        groundHeight: Math.max(groundHeight, 0),
        ident: fix.ident,
        stage: fix.stage,
        wind: `${fix.wind_dir}°/${fix.wind_spd}kt`,
        oat: `${fix.oat}°C`,
        isTopOfClimb,
        isTopOfDescent,
      });
    }

    const maxAlt = Math.max(...points.map((p) => p.altitude), 10000);
    // Round up to nearest 10000
    const roundedMax = Math.ceil(maxAlt / 10000) * 10000;

    return {
      data: points,
      tocDistance: tocDist,
      todDistance: todDist,
      maxAltitude: roundedMax,
    };
  }, [fixes]);

  if (data.length < 2) {
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No profile data available
        </div>
      </div>
    );
  }

  const totalDistance = data[data.length - 1]?.distance || 0;

  return (
    <div className={className} style={{ minHeight: 100 }}>
      <ChartContainer config={chartConfig} className="h-full w-full">
        <AreaChart data={data} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="terrainGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(var(--muted-foreground))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="oklch(var(--muted-foreground))" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border))" />

          <XAxis
            dataKey="distance"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            tickFormatter={(value) => `${value}`}
            stroke="oklch(var(--muted-foreground))"
          />

          <YAxis
            domain={[0, maxAltitude]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            tickFormatter={(value) => (value >= 10000 ? `FL${value / 100}` : `${value / 1000}k`)}
            stroke="oklch(var(--muted-foreground))"
            width={45}
          />

          {/* TOC Reference Line */}
          {tocDistance && (
            <ReferenceLine
              x={tocDistance}
              stroke="oklch(var(--success))"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: 'T/C',
                position: 'top',
                fill: 'oklch(var(--success))',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          )}

          {/* TOD Reference Line */}
          {todDistance && (
            <ReferenceLine
              x={todDistance}
              stroke="oklch(var(--warning))"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: 'T/D',
                position: 'top',
                fill: 'oklch(var(--warning))',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          )}

          {/* Terrain Area */}
          <Area
            type="monotone"
            dataKey="groundHeight"
            stroke="oklch(var(--muted-foreground))"
            strokeWidth={1}
            fill="url(#terrainGradient)"
            isAnimationActive={false}
          />

          {/* Flight Path Area */}
          <Area
            type="monotone"
            dataKey="altitude"
            stroke="oklch(var(--primary))"
            strokeWidth={2}
            fill="url(#altitudeGradient)"
            isAnimationActive={false}
            dot={false}
            activeDot={{
              r: 5,
              fill: 'oklch(var(--primary))',
              stroke: 'oklch(var(--background))',
              strokeWidth: 2,
            }}
          />

          <ChartTooltip
            content={({ active, payload }) => (
              <CustomTooltip
                active={active}
                payload={payload as Array<{ payload: ProfileDataPoint }> | undefined}
              />
            )}
            cursor={{
              stroke: 'oklch(var(--muted-foreground))',
              strokeDasharray: '4 4',
            }}
          />
        </AreaChart>
      </ChartContainer>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded bg-primary" />
          <span className="text-muted-foreground">Flight Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded bg-muted-foreground/30" />
          <span className="text-muted-foreground">Terrain</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded border-t-2 border-dashed border-success" />
          <span className="text-muted-foreground">T/C</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded border-t-2 border-dashed border-warning" />
          <span className="text-muted-foreground">T/D</span>
        </div>
        <span className="text-muted-foreground">
          Total: <span className="font-mono">{totalDistance} nm</span>
        </span>
      </div>
    </div>
  );
}
