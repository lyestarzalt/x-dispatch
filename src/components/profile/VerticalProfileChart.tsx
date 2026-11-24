import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnits } from '@/hooks/useUnits';
import type { Feet, NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import {
  type ChartBox,
  type Domain,
  areaPath,
  centerDomain,
  linePath,
  makeScales,
  minSpanNm,
  nearestRowIndex,
  panDomain,
  stepAfterPath,
  ticks,
  ticksBetween,
  zoomDomain,
} from './profileChartGeometry';

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
  safeAltitudeFt?: Feet | null;
  className?: string;
  /** Hide the legend row (for tight spaces). */
  compact?: boolean;
  /** The row under the cursor (and the one after it, for direction), or null on leave. */
  onHover?: (row: VerticalProfileRow | null, next: VerticalProfileRow | null) => void;
}

/** Space for the axes around the plot, px. */
const MARGIN = { top: 20, right: 10, bottom: 22, left: 68 };
const AXIS_FONT = 10;
const COLOR = {
  primary: 'oklch(var(--primary))',
  muted: 'oklch(var(--muted-foreground))',
  border: 'oklch(var(--border))',
  foreground: 'oklch(var(--foreground))',
  background: 'oklch(var(--background))',
  success: 'oklch(var(--success))',
  warning: 'oklch(var(--warning))',
  destructive: 'oklch(var(--destructive))',
};

const rowDistance = (r: VerticalProfileRow) => r.distance;
const rowAltitude = (r: VerticalProfileRow) => r.altitude;
const rowGround = (r: VerticalProfileRow) => r.groundHeight;
const rowLegSafe = (r: VerticalProfileRow) => r.legSafe;

function PointTooltip({ point }: { point: VerticalProfileRow }) {
  const { t } = useTranslation();
  const units = useUnits();
  return (
    <div className="bg-background rounded-lg border px-3 py-2">
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

const SEEK_HEIGHT = 18;
/** Wheel distance that doubles or halves the stretch shown. */
const WHEEL_PER_DOUBLING = 350;

/**
 * The whole route in miniature under a zoomed chart, with the stretch on screen marked. A
 * press or drag moves that stretch to the pointer.
 */
function SeekBar({
  rows,
  totalNm,
  maxFt,
  domain,
  width,
  left,
  right,
  onSeek,
}: {
  rows: VerticalProfileRow[];
  totalNm: number;
  maxFt: number;
  domain: Domain;
  width: number;
  left: number;
  right: number;
  onSeek: (atNm: number) => void;
}) {
  const { t } = useTranslation();
  const dragging = useRef(false);
  const mini = useMemo(() => {
    const box: ChartBox = {
      width,
      height: SEEK_HEIGHT,
      left,
      top: 2,
      right,
      bottom: SEEK_HEIGHT - 2,
    };
    const scales = makeScales(box, [0, totalNm], maxFt);
    return {
      scales,
      ground: areaPath(rows, rowDistance, rowGround, scales, box.bottom),
      line: linePath(rows, rowDistance, rowAltitude, scales),
    };
  }, [rows, totalNm, maxFt, width, left, right]);
  const seek = (e: React.PointerEvent<SVGSVGElement>) =>
    onSeek(mini.scales.invertX(e.clientX - e.currentTarget.getBoundingClientRect().left));
  const windowFrom = mini.scales.x(domain[0]);
  const windowTo = mini.scales.x(domain[1]);
  return (
    <svg
      width={width}
      height={SEEK_HEIGHT}
      role="slider"
      aria-label={t('profile.seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalNm)}
      aria-valuenow={Math.round((domain[0] + domain[1]) / 2)}
      className="mt-1 shrink-0 cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) seek(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <rect
        x={left}
        y={1}
        width={Math.max(0, right - left)}
        height={SEEK_HEIGHT - 2}
        rx={2}
        fill={COLOR.border}
        fillOpacity={0.35}
      />
      {mini.ground && <path d={mini.ground} fill={COLOR.muted} fillOpacity={0.5} />}
      {mini.line && <path d={mini.line} fill="none" stroke={COLOR.primary} strokeWidth={1} />}
      <rect
        x={windowFrom}
        y={0.5}
        width={Math.max(2, windowTo - windowFrom)}
        height={SEEK_HEIGHT - 1}
        rx={2}
        fill={COLOR.primary}
        fillOpacity={0.15}
        stroke={COLOR.primary}
        strokeWidth={1}
      />
    </svg>
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
  const gradientId = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The hovered row, tied to the rows it was taken from: a new route starts with none.
  const [hover, setHover] = useState<{ rows: VerticalProfileRow[]; index: number } | null>(null);
  const hoverRef = useRef<{ rows: VerticalProfileRow[]; index: number } | null>(null);
  const hoverIndex = hover && hover.rows === rows ? hover.index : -1;
  const pendingX = useRef<number | null>(null);
  const frame = useRef(0);
  // The stretch shown, tied to the rows like the hover: a new route starts zoomed out.
  const [zoom, setZoom] = useState<{ rows: VerticalProfileRow[]; domain: Domain } | null>(null);
  const panStart = useRef<{ x: number; domain: Domain } | null>(null);

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

  const totalDistance = rows[rows.length - 1]?.distance ?? 0;
  const zoomed = zoom && zoom.rows === rows ? zoom.domain : null;
  const viewFrom = zoomed ? zoomed[0] : 0;
  const viewTo = zoomed ? zoomed[1] : totalDistance;
  const setView = useCallback(
    (domain: Domain | null) => setZoom(domain ? { rows, domain } : null),
    [rows]
  );

  // The plot follows its box; whole pixels, so a sub-pixel jitter redraws nothing.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const width = Math.round(el.clientWidth);
      const height = Math.round(el.clientHeight);
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Every line is built once per data or size change; hovering only moves the cursor.
  const chart = useMemo(() => {
    if (size.width === 0 || size.height === 0 || rows.length < 2) return null;
    const box: ChartBox = {
      width: size.width,
      height: size.height,
      left: MARGIN.left,
      top: MARGIN.top,
      right: Math.max(MARGIN.left + 1, size.width - MARGIN.right),
      bottom: Math.max(MARGIN.top + 1, size.height - MARGIN.bottom),
    };
    const scales = makeScales(box, [viewFrom, viewTo], maxAltitude);
    const plotWidth = box.right - box.left;
    return {
      box,
      scales,
      xTicks: ticksBetween(viewFrom, viewTo, Math.max(2, Math.min(8, Math.floor(plotWidth / 90)))),
      yTicks: ticks(maxAltitude, compact ? 3 : 4),
      altitudeArea: areaPath(rows, rowDistance, rowAltitude, scales, box.bottom),
      altitudeLine: linePath(rows, rowDistance, rowAltitude, scales),
      terrainArea: hasTerrain ? areaPath(rows, rowDistance, rowGround, scales, box.bottom) : '',
      terrainLine: hasTerrain ? linePath(rows, rowDistance, rowGround, scales) : '',
      legSafeLine: hasLegSafe ? stepAfterPath(rows, rowDistance, rowLegSafe, scales) : '',
    };
  }, [size, rows, viewFrom, viewTo, maxAltitude, hasTerrain, hasLegSafe, compact]);

  // The wheel zooms around the pointer. A native listener, so the page and the map underneath
  // do not scroll or zoom too.
  const wheelState = useRef({ chart, viewFrom, viewTo, totalDistance, setView });
  useEffect(() => {
    wheelState.current = { chart, viewFrom, viewTo, totalDistance, setView };
  });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const s = wheelState.current;
      if (!s.chart || s.totalDistance <= 0) return;
      e.preventDefault();
      const px = e.clientX - el.getBoundingClientRect().left;
      const factor = 2 ** (e.deltaY / WHEEL_PER_DOUBLING);
      const at = s.chart.scales.invertX(px);
      s.setView(zoomDomain([s.viewFrom, s.viewTo], s.totalDistance, at, factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) =>
    setView(zoomDomain([viewFrom, viewTo], totalDistance, (viewFrom + viewTo) / 2, factor));

  const report = useCallback(
    (index: number) => {
      const current = hoverRef.current;
      if (current && current.rows === rows && current.index === index) return;
      if (!current && index < 0) return;
      const next = index < 0 ? null : { rows, index };
      hoverRef.current = next;
      setHover(next);
      if (index < 0) onHover?.(null, null);
      else onHover?.(rows[index] ?? null, rows[index + 1] ?? rows[index - 1] ?? null);
    },
    [rows, onHover]
  );

  // At most one lookup per frame, however fast the pointer moves.
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!chart) return;
      // Dragging a zoomed chart slides the route under the pointer.
      const pan = panStart.current;
      if (pan) {
        const plotWidth = chart.box.right - chart.box.left;
        const deltaNm = (-(e.clientX - pan.x) / plotWidth) * (pan.domain[1] - pan.domain[0]);
        setView(panDomain(pan.domain, totalDistance, deltaNm));
        return;
      }
      pendingX.current = e.clientX - e.currentTarget.getBoundingClientRect().left;
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const px = pendingX.current;
        if (px === null) return;
        report(nearestRowIndex(rows, rowDistance, chart.scales.invertX(px)));
      });
    },
    [chart, rows, report, setView, totalDistance]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!zoomed || e.button !== 0) return;
    panStart.current = { x: e.clientX, domain: zoomed };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const endPan = () => {
    panStart.current = null;
  };

  const handlePointerLeave = useCallback(() => {
    pendingX.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    report(-1);
  }, [report]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  if (rows.length < 2) {
    return (
      <div className={className}>
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          {t('profile.noData')}
        </div>
      </div>
    );
  }

  const hovered = hoverIndex >= 0 ? rows[hoverIndex] : undefined;
  const hoverX = hovered && chart ? chart.scales.x(hovered.distance) : null;
  const tooltipOnLeft = hoverX !== null && chart ? hoverX > chart.box.width / 2 : false;

  return (
    <div className={cn('flex flex-col', className)} style={{ minHeight: 100 }}>
      <div ref={wrapRef} className="relative min-h-0 w-full flex-1">
        {chart && (
          <svg
            width={chart.box.width}
            height={chart.box.height}
            className={cn(
              'absolute inset-0 touch-none select-none',
              zoomed && 'cursor-grab active:cursor-grabbing'
            )}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onDoubleClick={() => setView(null)}
          >
            <defs>
              <linearGradient id={`${gradientId}-alt`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={COLOR.primary} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id={`${gradientId}-ground`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.muted} stopOpacity={0.95} />
                <stop offset="100%" stopColor={COLOR.muted} stopOpacity={0.7} />
              </linearGradient>
              <clipPath id={`${gradientId}-plot`}>
                <rect
                  x={chart.box.left}
                  y={0}
                  width={chart.box.right - chart.box.left}
                  height={chart.box.bottom}
                />
              </clipPath>
            </defs>

            {chart.yTicks.map((v) => (
              <g key={`y${v}`}>
                <line
                  x1={chart.box.left}
                  x2={chart.box.right}
                  y1={chart.scales.y(v)}
                  y2={chart.scales.y(v)}
                  stroke={COLOR.border}
                  strokeDasharray="3 3"
                />
                <text
                  x={chart.box.left - 8}
                  y={chart.scales.y(v)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={AXIS_FONT}
                  fill={COLOR.muted}
                >
                  {units.altitude(v as Feet)}
                </text>
              </g>
            ))}
            {chart.xTicks.map((v) => (
              <text
                key={`x${v}`}
                x={chart.scales.x(v)}
                y={chart.box.bottom + 14}
                textAnchor="middle"
                fontSize={AXIS_FONT}
                fill={COLOR.muted}
              >
                {units.distance(v as NauticalMiles)}
              </text>
            ))}

            {/* Everything along the route is clipped to the plot, so a zoomed chart stays inside it. */}
            <g clipPath={`url(#${gradientId}-plot)`}>
              {tocDistance !== null && (
                <g>
                  <line
                    x1={chart.scales.x(tocDistance)}
                    x2={chart.scales.x(tocDistance)}
                    y1={chart.box.top}
                    y2={chart.box.bottom}
                    stroke={COLOR.success}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <text
                    x={chart.scales.x(tocDistance)}
                    y={chart.box.top - 6}
                    textAnchor="middle"
                    fontSize={AXIS_FONT}
                    fontWeight="bold"
                    fill={COLOR.success}
                  >
                    {t('profile.toc')}
                  </text>
                </g>
              )}
              {todDistance !== null && todDistance !== tocDistance && (
                <g>
                  <line
                    x1={chart.scales.x(todDistance)}
                    x2={chart.scales.x(todDistance)}
                    y1={chart.box.top}
                    y2={chart.box.bottom}
                    stroke={COLOR.warning}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <text
                    x={chart.scales.x(todDistance)}
                    y={chart.box.top - 6}
                    textAnchor="middle"
                    fontSize={AXIS_FONT}
                    fontWeight="bold"
                    fill={COLOR.warning}
                  >
                    {t('profile.tod')}
                  </text>
                </g>
              )}
              {safeAltitudeFt ? (
                <g>
                  <line
                    x1={chart.box.left}
                    x2={chart.box.right}
                    y1={chart.scales.y(safeAltitudeFt)}
                    y2={chart.scales.y(safeAltitudeFt)}
                    stroke={COLOR.destructive}
                    strokeWidth={1.5}
                  />
                  <text
                    x={chart.box.right - 4}
                    y={chart.scales.y(safeAltitudeFt) - 4}
                    textAnchor="end"
                    fontSize={AXIS_FONT}
                    fill={COLOR.destructive}
                  >
                    {`${t('profile.safeAltitude')} ${units.altitude(safeAltitudeFt as Feet)}`}
                  </text>
                </g>
              ) : null}

              {chart.terrainArea && (
                <path d={chart.terrainArea} fill={`url(#${gradientId}-ground)`} stroke="none" />
              )}
              {chart.terrainLine && (
                <path
                  d={chart.terrainLine}
                  fill="none"
                  stroke={COLOR.foreground}
                  strokeOpacity={0.8}
                  strokeWidth={1.5}
                />
              )}
              {chart.legSafeLine && (
                <path
                  d={chart.legSafeLine}
                  fill="none"
                  stroke={COLOR.warning}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
              )}
              {chart.altitudeArea && (
                <path d={chart.altitudeArea} fill={`url(#${gradientId}-alt)`} stroke="none" />
              )}
              {chart.altitudeLine && (
                <path d={chart.altitudeLine} fill="none" stroke={COLOR.primary} strokeWidth={2} />
              )}
            </g>

            {hovered && hoverX !== null && (
              <g pointerEvents="none">
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={chart.box.top}
                  y2={chart.box.bottom}
                  stroke={COLOR.muted}
                  strokeDasharray="4 4"
                />
                {hovered.altitude !== null && (
                  <circle
                    cx={hoverX}
                    cy={chart.scales.y(hovered.altitude)}
                    r={5}
                    fill={COLOR.primary}
                    stroke={COLOR.background}
                    strokeWidth={2}
                  />
                )}
              </g>
            )}
          </svg>
        )}
        {hovered && hoverX !== null && chart && (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              top: chart.box.top,
              left: tooltipOnLeft ? hoverX - 12 : hoverX + 12,
              transform: tooltipOnLeft ? 'translateX(-100%)' : undefined,
            }}
          >
            <PointTooltip point={hovered} />
          </div>
        )}
        {chart && (
          <div className="absolute top-0 right-1 flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={t('profile.zoomIn')}
              title={t('profile.zoomIn')}
              disabled={zoomed !== null && zoomed[1] - zoomed[0] <= minSpanNm(totalDistance) + 1e-6}
              onClick={() => zoomBy(0.5)}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={t('profile.zoomOut')}
              title={t('profile.zoomOut')}
              disabled={zoomed === null}
              onClick={() => zoomBy(2)}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {zoomed && chart && (
        <SeekBar
          rows={rows}
          totalNm={totalDistance}
          maxFt={maxAltitude}
          domain={zoomed}
          width={chart.box.width}
          left={chart.box.left}
          right={chart.box.right}
          onSeek={(at) => setView(centerDomain(zoomed, totalDistance, at))}
        />
      )}
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

/**
 * Memoised: the strip re-renders while dragged, the chart must not. Plain SVG drawn from
 * precomputed paths, so the pointer moving over it redraws only the cursor and tooltip.
 */
export const VerticalProfileChart = memo(VerticalProfileChartInner);
