import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { useMapStore } from '@/stores/mapStore';
import type { PlaneState } from '@/types/xplane';

const DRAG_THRESHOLD = 5;
const EDGE_PADDING = 16;

interface FlightStripProps {
  planeState: Partial<PlaneState> | null;
  connected: boolean;
  onCenterPlane: () => void;
}

// --- Formatting helpers ---

function formatValue(value: number | undefined, decimals = 0): string {
  if (value === undefined || isNaN(value)) return '---';
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatHeading(heading: number | undefined): string {
  if (heading === undefined || isNaN(heading)) return '---';
  const normalized = ((heading % 360) + 360) % 360;
  return normalized.toFixed(0).padStart(3, '0');
}

function formatVS(vs: number | undefined): string {
  if (vs === undefined || isNaN(vs)) return '---';
  const rounded = Math.round(vs / 100) * 100;
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatMach(mach: number | undefined): string {
  if (mach === undefined || isNaN(mach)) return '---';
  return mach.toFixed(2);
}

function formatWind(dir: number | undefined, speed: number | undefined): string {
  if (dir === undefined || speed === undefined || isNaN(dir) || isNaN(speed)) return '---';
  const d = Math.round((((dir % 360) + 360) % 360) / 10) * 10;
  const s = Math.round(speed);
  return `${String(d).padStart(3, '0')}/${s}`;
}

function formatOAT(oat: number | undefined): string {
  if (oat === undefined || isNaN(oat)) return '---';
  return Math.round(oat).toString();
}

// --- Color helpers ---

function getVSColor(vs: number | undefined): string {
  if (vs === undefined || isNaN(vs)) return 'text-muted-foreground';
  const rounded = Math.round(vs / 100) * 100;
  if (rounded > 0) return 'text-success';
  if (rounded < 0) return 'text-foreground';
  return 'text-muted-foreground';
}

function getAGLColor(agl: number | undefined): string {
  if (agl === undefined || isNaN(agl)) return 'text-foreground';
  return agl < 500 ? 'text-warning' : 'text-foreground';
}

// --- Drag hook ---

function useDragPosition() {
  const position = useMapStore((s) => s.flightStripPosition);
  const setPosition = useMapStore((s) => s.setFlightStripPosition);

  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const stripRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't drag from buttons
      if ((e.target as HTMLElement).closest('button')) return;

      const el = stripRef.current;
      if (!el) return;

      isDragging.current = true;
      hasDragged.current = false;
      startMouse.current = { x: e.clientX, y: e.clientY };

      // If position is null (default), compute current position from DOM
      const rect = el.getBoundingClientRect();
      startPos.current = position ?? { x: rect.left, y: rect.top };
    },
    [position]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !stripRef.current) return;

      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;

      if (!hasDragged.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      hasDragged.current = true;

      const rect = stripRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - EDGE_PADDING;
      const maxY = window.innerHeight - rect.height - EDGE_PADDING;

      const newX = Math.max(EDGE_PADDING, Math.min(maxX, startPos.current.x + dx));
      const newY = Math.max(EDGE_PADDING, Math.min(maxY, startPos.current.y + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      setTimeout(() => {
        hasDragged.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setPosition]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setPosition(null);
    },
    [setPosition]
  );

  return { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick };
}

// --- Main component ---

export default function FlightStrip({ planeState, connected, onCenterPlane }: FlightStripProps) {
  const { t } = useTranslation();
  const followPlane = useMapStore((s) => s.followPlane);
  const { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick } = useDragPosition();

  if (!connected) return null;

  const handleCenter = () => {
    if (hasDragged.current) return;
    onCenterPlane();
  };

  const isDefault = position === null;

  return (
    <div
      ref={stripRef}
      className={cn(
        'z-20 select-none',
        isDefault && 'absolute bottom-4 left-1/2 -translate-x-1/2',
        !isDefault && 'fixed'
      )}
      style={!isDefault ? { left: position.x, top: position.y } : undefined}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={cn(
          'flex items-center rounded-xl border',
          'border-border/50 bg-card/90 shadow-2xl shadow-black/50',
          'backdrop-blur-xl',
          'cursor-grab active:cursor-grabbing'
        )}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 px-3 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
          <Plane className="h-3.5 w-3.5 text-primary" />
        </div>

        <GroupSeparator />

        {/* Speeds group */}
        <div className="flex items-center gap-3 px-3 py-1.5">
          <DataBlock
            label={t('flightStrip.ias')}
            value={formatValue(planeState?.indicatedAirspeed)}
            unit={t('units.kt')}
            valueColor="text-primary"
          />
          <DataBlock
            label={t('flightStrip.gs')}
            value={formatValue(planeState?.groundspeed)}
            unit={t('units.kt')}
            valueColor="text-primary"
          />
          <DataBlock
            label={t('flightStrip.mach')}
            value={formatMach(planeState?.mach)}
            unit=""
            valueColor="text-primary"
          />
        </div>

        <GroupSeparator />

        {/* Altitudes group */}
        <div className="flex items-center gap-3 px-3 py-1.5">
          <DataBlock
            label={t('flightStrip.alt')}
            value={formatValue(planeState?.altitudeMSL)}
            unit={t('units.ft')}
          />
          <DataBlock
            label={t('flightStrip.agl')}
            value={formatValue(planeState?.altitudeAGL)}
            unit={t('units.ft')}
            valueColor={getAGLColor(planeState?.altitudeAGL)}
          />
          <DataBlock
            label={t('flightStrip.vs')}
            value={formatVS(planeState?.verticalSpeed)}
            unit={t('units.fpm')}
            valueColor={getVSColor(planeState?.verticalSpeed)}
          />
        </div>

        <GroupSeparator />

        {/* Navigation group */}
        <div className="px-3 py-1.5">
          <DataBlock
            label={t('flightStrip.hdg')}
            value={formatHeading(planeState?.heading)}
            unit="°"
          />
        </div>

        <GroupSeparator />

        {/* Environment group */}
        <div className="flex items-center gap-3 px-3 py-1.5">
          <DataBlock
            label={t('flightStrip.wind')}
            value={formatWind(planeState?.windDirection, planeState?.windSpeed)}
            unit={t('units.kt')}
          />
          <DataBlock label={t('flightStrip.oat')} value={formatOAT(planeState?.oat)} unit="°C" />
        </div>

        <GroupSeparator />

        {/* Center / Follow button */}
        <div className="px-1.5 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCenter}
            className={cn('h-8 rounded-lg px-2.5', followPlane && 'bg-info/20 text-info')}
            tooltip={
              followPlane ? t('flightStrip.followingTooltip') : t('flightStrip.centerTooltip')
            }
          >
            <Crosshair className={cn('mr-1.5 h-3.5 w-3.5', followPlane && 'animate-pulse')} />
            {followPlane ? t('flightStrip.following') : t('flightStrip.center')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function GroupSeparator() {
  return <div className="h-8 w-px bg-border/50" />;
}

interface DataBlockProps {
  label: string;
  value: string;
  unit: string;
  valueColor?: string;
}

function DataBlock({ label, value, unit, valueColor }: DataBlockProps) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span
          className={cn(
            'font-mono text-sm font-medium tabular-nums',
            valueColor || 'text-foreground'
          )}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
