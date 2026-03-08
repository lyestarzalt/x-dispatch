import { useCallback, useRef, useState } from 'react';
import type { CloudLayer, WindLayer } from '../weatherTypes';
import { CLOUD_TYPE_LABELS, getCoverageCategory } from '../weatherTypes';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SelectedLayer {
  kind: 'cloud' | 'wind';
  index: number;
}

interface AltitudeDiagramProps {
  clouds: CloudLayer[];
  wind: WindLayer[];
  airportElevationFt?: number;
  selectedLayer: SelectedLayer | null;
  onSelectLayer: (sel: SelectedLayer | null) => void;
  onUpdateCloud: (index: number, data: Partial<CloudLayer>) => void;
  onUpdateWind: (index: number, data: Partial<WindLayer>) => void;
  disabled?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_ALT = 50000;
const SNAP = 500;
const DRAG_THRESHOLD = 3;

// ViewBox layout
const VB_W = 600;
const VB_H = 560;
const PAD_LEFT = 8;
const PAD_RIGHT = 80;
const PAD_TOP = 8;
const PAD_BOTTOM = 28;
const CHART_X = PAD_LEFT;
const CHART_W = VB_W - PAD_LEFT - PAD_RIGHT;
const CHART_Y = PAD_TOP;
const CHART_H = VB_H - PAD_TOP - PAD_BOTTOM;

// Icon tab dimensions (the small box on the right side)
const TAB_W = 36;
const TAB_H = 32;

// Cloud type → design token
const CLOUD_TOKEN: Record<CloudLayer['type'], string> = {
  cirrus: '--cat-sky',
  stratus: '--muted-foreground',
  cumulus: '--primary',
  cumulonimbus: '--destructive',
};

// Drag kind: cloud-body moves the whole cloud, cloud-tops/cloud-base resize edges
type DragKind = 'cloud-body' | 'cloud-base' | 'cloud-tops' | 'wind';

// ─── Helpers ────────────────────────────────────────────────────────────────

function altToY(alt: number): number {
  return CHART_Y + CHART_H - (alt / MAX_ALT) * CHART_H;
}

function yToAlt(y: number): number {
  const raw = ((CHART_Y + CHART_H - y) / CHART_H) * MAX_ALT;
  return Math.round(Math.max(0, Math.min(MAX_ALT, raw)) / SNAP) * SNAP;
}

function formatAlt(ft: number): string {
  if (ft === 0) return '0 ft MSL';
  return `${ft.toLocaleString()} ft MSL`;
}

/**
 * Cloud block path: main rectangle + small icon tab on the upper-right.
 */
function cloudBlockPath(x: number, yTop: number, w: number, h: number): string {
  const r = 4;
  const tabH = Math.min(TAB_H, h);
  const mainW = w - TAB_W;

  return [
    `M${x + r},${yTop}`,
    `H${x + mainW}`,
    `H${x + w - r}`,
    `a${r},${r} 0 0 1 ${r},${r}`,
    `V${yTop + tabH - r}`,
    `a${r},${r} 0 0 1 -${r},${r}`,
    `H${x + mainW}`,
    `V${yTop + h - r}`,
    `a${r},${r} 0 0 1 -${r},${r}`,
    `H${x + r}`,
    `a${r},${r} 0 0 1 -${r},-${r}`,
    `V${yTop + r}`,
    `a${r},${r} 0 0 1 ${r},-${r}`,
    'Z',
  ].join(' ');
}

// Lucide icon paths (simplified from lucide SVGs)
const CLOUD_ICON_PATH = 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z';
const WIND_ICON_PATH =
  'M17.7 7.7A2.5 2.5 0 0 1 15 11H2 M9.6 4.6A2 2 0 0 1 8 8H2 M12.6 19.4A2 2 0 0 0 11 16H2';

// ─── Component ──────────────────────────────────────────────────────────────

export function AltitudeDiagram({
  clouds,
  wind,
  airportElevationFt = 0,
  selectedLayer,
  onSelectLayer,
  onUpdateCloud,
  onUpdateWind,
  disabled,
}: AltitudeDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const dragRef = useRef<{
    kind: DragKind;
    index: number;
    startY: number;
    startAlt: number;
    // For cloud-body drag: remember original base+tops to translate both
    origBase?: number;
    origTops?: number;
    moved: boolean;
  } | null>(null);
  const [, setDragTick] = useState(0);

  const svgPointFromEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm);
    return { x: transformed.x, y: transformed.y };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, kind: DragKind, index: number, currentAlt: number) => {
      if (disabled) return;
      e.stopPropagation();
      (e.target as SVGElement).setPointerCapture(e.pointerId);
      const { y } = svgPointFromEvent(e);

      const cloud = kind.startsWith('cloud') ? clouds[index] : undefined;
      dragRef.current = {
        kind,
        index,
        startY: y,
        startAlt: currentAlt,
        origBase: cloud?.base_ft,
        origTops: cloud?.tops_ft,
        moved: false,
      };
    },
    [disabled, svgPointFromEvent, clouds]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { y } = svgPointFromEvent(e);
      const dy = Math.abs(y - drag.startY);
      if (!drag.moved && dy < DRAG_THRESHOLD) return;
      drag.moved = true;

      const newAlt = yToAlt(y);

      if (drag.kind === 'cloud-body') {
        // Move the whole cloud: compute delta from start, apply to both base+tops
        const delta = newAlt - drag.startAlt;
        const origBase = drag.origBase!;
        const origTops = drag.origTops!;
        const thickness = origTops - origBase;

        let newBase = origBase + delta;
        let newTops = origTops + delta;

        // Clamp to bounds
        if (newBase < 0) {
          newBase = 0;
          newTops = thickness;
        }
        if (newTops > MAX_ALT) {
          newTops = MAX_ALT;
          newBase = MAX_ALT - thickness;
        }

        onUpdateCloud(drag.index, { base_ft: newBase, tops_ft: newTops });
      } else if (drag.kind === 'cloud-base') {
        const cloud = clouds[drag.index];
        const maxBase = Math.max(0, cloud.tops_ft - SNAP);
        onUpdateCloud(drag.index, { base_ft: Math.min(newAlt, maxBase) });
      } else if (drag.kind === 'cloud-tops') {
        const cloud = clouds[drag.index];
        const minTops = cloud.base_ft + SNAP;
        onUpdateCloud(drag.index, { tops_ft: Math.max(newAlt, minTops) });
      } else if (drag.kind === 'wind') {
        onUpdateWind(drag.index, { altitude_ft: newAlt });
      }
    },
    [clouds, onUpdateCloud, onUpdateWind, svgPointFromEvent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      (e.target as SVGElement).releasePointerCapture(e.pointerId);

      if (!drag.moved) {
        const layerKind = drag.kind === 'wind' ? 'wind' : 'cloud';
        onSelectLayer({ kind: layerKind, index: drag.index });
      }

      dragRef.current = null;
      setDragTick((t) => t + 1);
    },
    [onSelectLayer]
  );

  const handleBgClick = useCallback(() => {
    if (!disabled) onSelectLayer(null);
  }, [disabled, onSelectLayer]);

  // Altitude ticks every 10000 ft
  const ticks: number[] = [];
  for (let alt = 0; alt <= MAX_ALT; alt += 10000) ticks.push(alt);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Background */}
      <rect
        x={CHART_X}
        y={CHART_Y}
        width={CHART_W}
        height={CHART_H}
        rx="4"
        fill="oklch(var(--card))"
        onClick={handleBgClick}
      />

      {/* Altitude grid lines + labels on right edge */}
      {ticks.map((alt) => {
        const y = altToY(alt);
        // Hide 0 ft label when airport elevation marker is present (they overlap)
        const hideLabel = alt === 0 && airportElevationFt > 0;
        return (
          <g key={alt}>
            <line
              x1={CHART_X}
              y1={y}
              x2={CHART_X + CHART_W}
              y2={y}
              stroke="oklch(var(--border))"
              strokeWidth="0.5"
            />
            {!hideLabel && (
              <text
                x={CHART_X + CHART_W + 6}
                y={y + 3}
                textAnchor="start"
                fill="oklch(var(--muted-foreground))"
                fontSize="9"
                fontFamily="monospace"
              >
                {formatAlt(alt)}
              </text>
            )}
          </g>
        );
      })}

      {/* Ground level hatch below 0 ft line */}
      <defs>
        <pattern
          id="ground-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="oklch(var(--success) / 0.12)" strokeWidth="2" />
        </pattern>
      </defs>
      <rect
        x={CHART_X}
        y={altToY(0)}
        width={CHART_W}
        height={PAD_BOTTOM}
        fill="url(#ground-hatch)"
      />

      {/* Airport elevation marker */}
      {airportElevationFt > 0 && (
        <g>
          <line
            x1={CHART_X}
            y1={altToY(airportElevationFt)}
            x2={CHART_X + CHART_W}
            y2={altToY(airportElevationFt)}
            stroke="oklch(var(--success))"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
          <rect
            x={CHART_X}
            y={altToY(airportElevationFt)}
            width={CHART_W}
            height={altToY(0) - altToY(airportElevationFt)}
            fill="oklch(var(--success) / 0.06)"
          />
          <text
            x={CHART_X + CHART_W + 6}
            y={altToY(airportElevationFt) + 3}
            textAnchor="start"
            fill="oklch(var(--success))"
            fontSize="9"
            fontWeight="500"
            fontFamily="monospace"
          >
            {airportElevationFt.toLocaleString()} ft — Airport
          </text>
        </g>
      )}

      {/* ── Cloud layers ── */}
      {clouds.map((cloud, i) => {
        const yTop = altToY(cloud.tops_ft);
        const yBase = altToY(cloud.base_ft);
        const h = Math.max(yBase - yTop, 6);
        const token = CLOUD_TOKEN[cloud.type];
        const isSelected = selectedLayer?.kind === 'cloud' && selectedLayer.index === i;
        const opacity = 0.15 + cloud.cover * 0.35;
        const covCat = getCoverageCategory(cloud.cover);
        const covLabel = covCat.charAt(0).toUpperCase() + covCat.slice(1);

        const bodyX = CHART_X + 4;
        const bodyW = CHART_W - 8;
        const tabX = bodyX + bodyW - TAB_W;
        const midAlt = Math.round((cloud.base_ft + cloud.tops_ft) / 2);

        return (
          <g key={`cloud-${i}`}>
            {/* Cloud block with icon tab — body drag moves whole cloud */}
            <path
              d={cloudBlockPath(bodyX, yTop, bodyW, h)}
              fill={`oklch(var(${token}) / ${opacity})`}
              stroke={isSelected ? 'oklch(var(--primary))' : `oklch(var(${token}) / 0.3)`}
              strokeWidth={isSelected ? 2 : 0.5}
              className={disabled ? '' : 'cursor-grab'}
              onPointerDown={(e) => handlePointerDown(e, 'cloud-body', i, midAlt)}
            />

            {/* Divider line between body and icon tab */}
            <line
              x1={tabX}
              y1={yTop + 1}
              x2={tabX}
              y2={yTop + Math.min(TAB_H, h) - 1}
              stroke={`oklch(var(${token}) / 0.3)`}
              strokeWidth="0.5"
              className="pointer-events-none"
            />

            {/* Lucide cloud icon inside the tab */}
            <g
              transform={`translate(${tabX + TAB_W / 2 - 8}, ${yTop + Math.min(TAB_H, h) / 2 - 8}) scale(0.67)`}
              className="pointer-events-none"
            >
              <path
                d={CLOUD_ICON_PATH}
                fill="none"
                stroke={`oklch(var(${token}))`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Cloud info label */}
            {h > 24 && (
              <text
                x={bodyX + (bodyW - TAB_W) / 2}
                y={yTop + h / 2 + 1}
                textAnchor="middle"
                fill="oklch(var(--foreground))"
                fontSize="11"
                fontWeight="500"
                className="pointer-events-none"
              >
                {covLabel} {CLOUD_TYPE_LABELS[cloud.type]} @ {cloud.base_ft.toLocaleString()}–
                {cloud.tops_ft.toLocaleString()} ft MSL
              </text>
            )}
            {h > 42 && (
              <text
                x={bodyX + (bodyW - TAB_W) / 2}
                y={yTop + h / 2 + 14}
                textAnchor="middle"
                fill="oklch(var(--muted-foreground))"
                fontSize="9"
                className="pointer-events-none"
              >
                {(cloud.tops_ft - cloud.base_ft).toLocaleString()} ft thick
              </text>
            )}

            {/* Top drag handle — resize tops only */}
            <rect
              x={CHART_X + CHART_W / 2 - TAB_W - 10}
              y={yTop - 4}
              width={40}
              height={8}
              rx="3"
              fill={isSelected ? 'oklch(var(--primary))' : `oklch(var(${token}) / 0.6)`}
              className={disabled ? '' : 'cursor-ns-resize'}
              onPointerDown={(e) => handlePointerDown(e, 'cloud-tops', i, cloud.tops_ft)}
            />
            <line
              x1={CHART_X + CHART_W / 2 - TAB_W - 6}
              y1={yTop - 1}
              x2={CHART_X + CHART_W / 2 - TAB_W + 14}
              y2={yTop - 1}
              stroke="oklch(var(--background) / 0.5)"
              strokeWidth="0.5"
              className="pointer-events-none"
            />
            <line
              x1={CHART_X + CHART_W / 2 - TAB_W - 6}
              y1={yTop + 1}
              x2={CHART_X + CHART_W / 2 - TAB_W + 14}
              y2={yTop + 1}
              stroke="oklch(var(--background) / 0.5)"
              strokeWidth="0.5"
              className="pointer-events-none"
            />

            {/* Bottom drag handle — resize base only */}
            <rect
              x={CHART_X + CHART_W / 2 - TAB_W - 10}
              y={yBase - 4}
              width={40}
              height={8}
              rx="3"
              fill={isSelected ? 'oklch(var(--primary))' : `oklch(var(${token}) / 0.6)`}
              className={disabled ? '' : 'cursor-ns-resize'}
              onPointerDown={(e) => handlePointerDown(e, 'cloud-base', i, cloud.base_ft)}
            />
            <line
              x1={CHART_X + CHART_W / 2 - TAB_W - 6}
              y1={yBase - 1}
              x2={CHART_X + CHART_W / 2 - TAB_W + 14}
              y2={yBase - 1}
              stroke="oklch(var(--background) / 0.5)"
              strokeWidth="0.5"
              className="pointer-events-none"
            />
            <line
              x1={CHART_X + CHART_W / 2 - TAB_W - 6}
              y1={yBase + 1}
              x2={CHART_X + CHART_W / 2 - TAB_W + 14}
              y2={yBase + 1}
              stroke="oklch(var(--background) / 0.5)"
              strokeWidth="0.5"
              className="pointer-events-none"
            />
          </g>
        );
      })}

      {/* ── Wind layers ── */}
      {wind.map((w, i) => {
        const y = altToY(w.altitude_ft);
        const isSelected = selectedLayer?.kind === 'wind' && selectedLayer.index === i;

        const tabX = CHART_X + CHART_W - TAB_W - 4;
        const tabY = y - TAB_H / 2;

        return (
          <g key={`wind-${i}`}>
            {/* Dashed line — stop before the icon tab */}
            <line
              x1={CHART_X}
              y1={y}
              x2={tabX - 4}
              y2={y}
              stroke={isSelected ? 'oklch(var(--primary))' : 'oklch(var(--primary) / 0.4)'}
              strokeWidth={isSelected ? 1.5 : 1}
              strokeDasharray={isSelected ? 'none' : '6 3'}
              className={disabled ? '' : 'cursor-ns-resize'}
              onPointerDown={(e) => handlePointerDown(e, 'wind', i, w.altitude_ft)}
            />

            {/* Wind icon tab */}
            <rect
              x={tabX}
              y={tabY}
              width={TAB_W}
              height={TAB_H}
              rx="4"
              fill={isSelected ? 'oklch(var(--primary) / 0.15)' : 'oklch(var(--card) / 0.9)'}
              stroke={isSelected ? 'oklch(var(--primary))' : 'oklch(var(--primary) / 0.4)'}
              strokeWidth={isSelected ? 1.5 : 0.5}
              className={disabled ? '' : 'cursor-ns-resize'}
              onPointerDown={(e) => handlePointerDown(e, 'wind', i, w.altitude_ft)}
            />

            {/* Lucide wind icon inside the tab */}
            <g
              transform={`translate(${tabX + TAB_W / 2 - 8}, ${tabY + TAB_H / 2 - 8}) scale(0.67)`}
              className="pointer-events-none"
            >
              <path
                d={WIND_ICON_PATH}
                fill="none"
                stroke={isSelected ? 'oklch(var(--primary))' : 'oklch(var(--primary) / 0.7)'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Direction arrow (left side) */}
            <g
              transform={`translate(${CHART_X + 24}, ${y}) rotate(${w.direction_deg})`}
              className="pointer-events-none"
            >
              <circle
                r="9"
                fill="oklch(var(--card) / 0.9)"
                stroke={isSelected ? 'oklch(var(--primary))' : 'oklch(var(--primary) / 0.5)'}
                strokeWidth="1"
              />
              <line
                x1="0"
                y1="6"
                x2="0"
                y2="-6"
                stroke={isSelected ? 'oklch(var(--primary))' : 'oklch(var(--primary) / 0.7)'}
                strokeWidth="1.5"
              />
              <polygon
                points="0,-7 -3,-3 3,-3"
                fill={isSelected ? 'oklch(var(--primary))' : 'oklch(var(--primary) / 0.7)'}
              />
            </g>

            {/* Speed + direction label */}
            <text
              x={CHART_X + 42}
              y={y - 6}
              textAnchor="start"
              fill={isSelected ? 'oklch(var(--foreground))' : 'oklch(var(--muted-foreground))'}
              fontSize="9"
              fontFamily="monospace"
              className="pointer-events-none"
            >
              {String(Math.round(w.direction_deg)).padStart(3, '0')}° @ {w.speed_kts} kts
              {w.gust_kts > 0 && ` G${w.speed_kts + w.gust_kts}`}
            </text>

            {/* Drag hit area */}
            <rect
              x={CHART_X}
              y={y - 8}
              width={CHART_W}
              height={16}
              fill="transparent"
              className={disabled ? '' : 'cursor-ns-resize'}
              onPointerDown={(e) => handlePointerDown(e, 'wind', i, w.altitude_ft)}
            />
          </g>
        );
      })}
    </svg>
  );
}
