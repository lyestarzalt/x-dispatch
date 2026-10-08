import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { useUnits } from '@/hooks/useUnits';
import type { Feet, NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';

/** One row of the chart's series; distances in NM, altitudes in feet. */
export interface VerticalProfileRow {
  distance: number;
  /** Where this row is on the map, when known; hovering it can be mirrored there. */
  latitude?: number;
  longitude?: number;
  altitude: number | null;
  groundHeight: number | null;
  /** Safe altitude of the leg this row lies on, when terrain is known. */
  legSafe?: number | null;
  ident?: string;
  isTopOfClimb?: boolean;
  isTopOfDescent?: boolean;
  wind?: string;
  oat?: string;
}

interface VerticalProfileChartProps {
  rows: VerticalProfileRow[];
  tocDistance: number | null;
  todDistance: number | null;
  /** Route minimum safe altitude, feet, drawn as a red line. */
  safeAltitudeFt?: number | null;
  className?: string;
  /** Hide the legend row (for tight spaces). */
  compact?: boolean;
  /** The row under the cursor (and the one after it, for direction), or null on leave. */
  onHover?: (row: VerticalProfileRow | null, next: VerticalProfileRow | null) => void;
}

// Recharts label placement keyword, not user-facing text.
const SAFE_LABEL_POSITION = 'insideTopRight';

const chartConfig = {
  altitude: { label: 'Altitude', color: 'oklch(var(--primary))' },
  groundHeight: { label: 'Terrain', color: 'oklch(var(--muted-foreground))' },
  legSafe: { label: 'Leg safe', color: 'oklch(var(--warning))' },
} satisfies ChartConfig;

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: VerticalProfileRow }>;
}) {
  const { t } = useTranslation();
  const units = useUnits();
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-xl">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono font-semibold">
          {point.ident ?? units.distance(point.distance as NauticalMiles)}
        </span>
        {point.isTopOfClimb && (
          <Badge variant="success" className="text-2xs">
            {t('profile.toc')}
          </Badge>
        )}
        {point.isTopOfDescent && (
          <Badge variant="warning" className="text-2xs">
            {t('profile.tod')}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {point.altitude !== null && (
          <>
            <span className="text-muted-foreground">{t('profile.altitude')}</span>
            <span className="text-right font-mono">{units.altitude(point.altitude as Feet)}</span>
          </>
        )}
        <span className="text-muted-foreground">{t('profile.distance')}</span>
        <span className="text-right font-mono">
          {units.distance(point.distance as NauticalMiles)}
        </span>
        {point.groundHeight !== null && (
          <>
            <span className="text-muted-foreground">{t('profile.terrain')}</span>
            <span className="text-right font-mono">
              {units.altitude(point.groundHeight as Feet)}
            </span>
          </>
        )}
        {point.legSafe !== null && point.legSafe !== undefined && (
          <>
            <span className="text-muted-foreground">{t('profile.legSafe')}</span>
            <span className="text-right font-mono">{units.altitude(point.legSafe as Feet)}</span>
          </>
        )}
        {point.wind && (
          <>
            <span className="text-muted-foreground">{t('profile.wind')}</span>
            <span className="text-right font-mono">{point.wind}</span>
          </>
        )}
        {point.oat && (
          <>
            <span className="text-muted-foreground">OAT</span>
            <span className="text-right font-mono">{point.oat}</span>
          </>
        )}
      </div>
    </div>
  );
}

function VerticalProfileChartInner({
  rows,
  tocDistance,
  todDistance,
  safeAltitudeFt,
  className,
  compact = false,
  onHover,
}: VerticalProfileChartProps) {
  const { t } = useTranslation();
  const units = useUnits();

  const { maxAltitude, hasTerrain, hasLegSafe } = useMemo(() => {
    let max = 10000;
    let terrain = false;
    let legSafe = false;
    for (const r of rows) {
      if (r.altitude !== null && r.altitude > max) max = r.altitude;
      if (r.groundHeight !== null) terrain = true;
      if (r.legSafe !== null && r.legSafe !== undefined) {
        legSafe = true;
        if (r.legSafe > max) max = r.legSafe;
      }
    }
    if (safeAltitudeFt && safeAltitudeFt > max) max = safeAltitudeFt;
    // Headroom above the highest line, rounded to a clean step.
    const step = max > 20000 ? 5000 : 2000;
    return {
      maxAltitude: Math.ceil((max * 1.1) / step) * step,
      hasTerrain: terrain,
      hasLegSafe: legSafe,
    };
  }, [rows, safeAltitudeFt]);

  if (rows.length < 2) {
    return (
      <div className={className}>
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          {t('profile.noData')}
        </div>
      </div>
    );
  }

  const totalDistance = rows[rows.length - 1]?.distance ?? 0;

  return (
    <div className={cn('flex flex-col', className)} style={{ minHeight: 100 }}>
      <ChartContainer config={chartConfig} className="min-h-0 w-full flex-1">
        <AreaChart
          data={rows}
          margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
          onMouseMove={(state) => {
            const index = state?.isTooltipActive ? Number(state.activeTooltipIndex) : NaN;
            if (!Number.isFinite(index)) onHover?.(null, null);
            else onHover?.(rows[index] ?? null, rows[index + 1] ?? rows[index - 1] ?? null);
          }}
          onMouseLeave={() => onHover?.(null, null)}
        >
          <defs>
            <linearGradient id="profileAltitudeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="profileTerrainGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(var(--muted-foreground))" stopOpacity={0.95} />
              <stop offset="100%" stopColor="oklch(var(--muted-foreground))" stopOpacity={0.7} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border))" />
          <XAxis
            dataKey="distance"
            type="number"
            domain={[0, totalDistance]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            tickFormatter={(value: number) => units.distance(value as NauticalMiles)}
            stroke="oklch(var(--muted-foreground))"
          />
          <YAxis
            domain={[0, maxAltitude]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            tickFormatter={(value: number) => units.altitude(value as Feet)}
            stroke="oklch(var(--muted-foreground))"
            width={60}
          />

          {tocDistance !== null && (
            <ReferenceLine
              x={tocDistance}
              stroke="oklch(var(--success))"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: t('profile.toc'),
                position: 'top',
                fill: 'oklch(var(--success))',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          )}
          {todDistance !== null && todDistance !== tocDistance && (
            <ReferenceLine
              x={todDistance}
              stroke="oklch(var(--warning))"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: t('profile.tod'),
                position: 'top',
                fill: 'oklch(var(--warning))',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          )}
          {safeAltitudeFt ? (
            <ReferenceLine
              y={safeAltitudeFt}
              stroke="oklch(var(--destructive))"
              strokeWidth={1.5}
              label={{
                value: `${t('profile.safeAltitude')} ${units.altitude(safeAltitudeFt as Feet)}`,
                position: SAFE_LABEL_POSITION,
                fill: 'oklch(var(--destructive))',
                fontSize: 10,
              }}
            />
          ) : null}

          {hasTerrain && (
            <Area
              type="linear"
              dataKey="groundHeight"
              stroke="oklch(var(--foreground))"
              strokeOpacity={0.8}
              strokeWidth={1.5}
              fill="url(#profileTerrainGradient)"
              isAnimationActive={false}
              connectNulls
            />
          )}
          {hasLegSafe && (
            <Line
              type="stepAfter"
              dataKey="legSafe"
              stroke="oklch(var(--warning))"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Area
            type="linear"
            dataKey="altitude"
            stroke="oklch(var(--primary))"
            strokeWidth={2}
            fill="url(#profileAltitudeGradient)"
            isAnimationActive={false}
            dot={false}
            connectNulls
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
                payload={payload as unknown as Array<{ payload: VerticalProfileRow }> | undefined}
              />
            )}
            cursor={{ stroke: 'oklch(var(--muted-foreground))', strokeDasharray: '4 4' }}
          />
        </AreaChart>
      </ChartContainer>

      <div
        className={
          compact
            ? 'text-2xs mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5'
            : 'mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs'
        }
      >
        <>
          <div className="flex items-center gap-1.5">
            <div className="bg-primary h-0.5 w-4 rounded" />
            <span className="text-muted-foreground">{t('profile.flightPath')}</span>
          </div>
          {hasTerrain && (
            <div className="flex items-center gap-1.5">
              <div className="bg-muted-foreground/30 h-2 w-4 rounded" />
              <span className="text-muted-foreground">{t('profile.terrain')}</span>
            </div>
          )}
          {hasLegSafe && (
            <div className="flex items-center gap-1.5">
              <div className="border-warning h-0.5 w-4 rounded border-t-2 border-dashed" />
              <span className="text-muted-foreground">{t('profile.legSafe')}</span>
            </div>
          )}
          {safeAltitudeFt ? (
            <div className="flex items-center gap-1.5">
              <div className="bg-destructive h-0.5 w-4 rounded" />
              <span className="text-muted-foreground">{t('profile.safeAltitude')}</span>
            </div>
          ) : null}
          <span className="text-muted-foreground">
            {t('profile.total')}{' '}
            <span className="font-mono">{units.distance(totalDistance as NauticalMiles)}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <div className="border-success h-0.5 w-4 rounded border-t-2 border-dashed" />
            <span className="text-muted-foreground">{t('profile.toc')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="border-warning h-0.5 w-4 rounded border-t-2 border-dashed" />
            <span className="text-muted-foreground">{t('profile.tod')}</span>
          </div>
        </>
      </div>
    </div>
  );
}

/** Memoised: the strip re-renders on every drag frame, the chart must not. */
export const VerticalProfileChart = memo(VerticalProfileChartInner);
