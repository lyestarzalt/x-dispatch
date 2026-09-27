import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Crosshair, Plane } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { exitEase, panelSpring, quickFade } from '@/lib/motionPresets';
import { cn } from '@/lib/utils/helpers';
import { useMapStore } from '@/stores/mapStore';
import { usePlaneStore } from '@/stores/planeStore';
import { useDragPosition } from '../hooks/useDragPosition';

const PRIMARY_COLOR_CLASS = 'text-primary';

interface FlightStripProps {
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
  return rounded > 0 ? `+${formatValue(rounded)}` : formatValue(rounded);
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

/** Autopilot dial value in the same format as the live reading; empty until a sample arrives. */
function formatTarget(
  format: (value: number | undefined) => string,
  value: number | undefined
): string | undefined {
  if (value === undefined || isNaN(value)) return undefined;
  return format(value);
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

function isLowAGL(agl: number | undefined): boolean {
  return agl !== undefined && !isNaN(agl) && agl < 500;
}

function useStripDrag() {
  const position = useMapStore((s) => s.flightStripPosition);
  const setPosition = useMapStore((s) => s.setFlightStripPosition);
  return useDragPosition(position, setPosition);
}

// --- Main component ---

export default function FlightStrip({ onCenterPlane }: FlightStripProps) {
  const planeState = usePlaneStore((s) => s.state);
  const connected = usePlaneStore((s) => s.connected);
  const { t } = useTranslation();
  const followPlane = useMapStore((s) => s.followPlane);
  const { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick } = useStripDrag();

  const handleCenter = () => {
    if (hasDragged.current) return;
    onCenterPlane();
  };

  const isDefault = position === null;

  return (
    <AnimatePresence>
      {connected && (
        <motion.div
          ref={stripRef}
          className={cn(
            'z-20 select-none',
            isDefault && 'absolute bottom-4 left-1/2',
            !isDefault && 'fixed'
          )}
          style={{
            // Centering stays a plain style transform so dragging never animates it.
            x: isDefault ? '-50%' : 0,
            ...(!isDefault ? { left: position.x, top: position.y } : undefined),
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: exitEase }}
          transition={panelSpring}
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
              <div className="bg-success h-2 w-2 animate-pulse rounded-full" />
              <Plane className="text-primary h-3.5 w-3.5" />
              {(planeState?.icaoType || planeState?.tailNumber) && (
                <div
                  className="flex flex-col leading-tight"
                  title={planeState?.aircraftName || undefined}
                >
                  <span className="text-foreground font-mono text-[11px] font-medium">
                    {planeState?.icaoType}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {planeState?.tailNumber}
                  </span>
                </div>
              )}
            </div>

            <GroupSeparator />

            {/* Five columns: the values you fly with are large, related
                secondary readings sit underneath in a muted line. */}
            <div className="flex items-center gap-4 px-4 py-1.5">
              <DataColumn
                label={t('flightStrip.ias')}
                target={formatTarget(
                  planeState?.apAirspeedIsMach ? formatMach : formatValue,
                  planeState?.apAirspeed
                )}
                value={formatValue(planeState?.indicatedAirspeed)}
                unit={t('units.kt')}
                valueColor={PRIMARY_COLOR_CLASS}
                secondary={`${t('flightStrip.gs')} ${formatValue(planeState?.groundspeed)} · ${t('flightStrip.mach')} ${formatMach(planeState?.mach)}`}
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.alt')}
                target={formatTarget(formatValue, planeState?.apAltitude)}
                value={formatValue(planeState?.altitudeMSL)}
                unit={t('units.ft')}
                valueColor={PRIMARY_COLOR_CLASS}
                secondary={
                  <span className={cn(isLowAGL(planeState?.altitudeAGL) && 'text-warning')}>
                    {t('flightStrip.agl')} {formatValue(planeState?.altitudeAGL)}
                  </span>
                }
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.vs')}
                target={formatTarget(formatVS, planeState?.apVerticalSpeed)}
                value={formatVS(planeState?.verticalSpeed)}
                unit={t('units.fpm')}
                valueColor={getVSColor(planeState?.verticalSpeed)}
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.hdg')}
                target={formatTarget(formatHeading, planeState?.apHeading)}
                value={formatHeading(planeState?.heading)}
                unit="°"
                valueColor={PRIMARY_COLOR_CLASS}
                secondary={`${t('flightStrip.crs')} ${formatHeading(planeState?.nav1Course)}°`}
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.wind')}
                value={formatWind(planeState?.windDirection, planeState?.windSpeed)}
                unit={t('units.kt')}
                secondary={`${t('flightStrip.oat')} ${formatOAT(planeState?.oat)}°C`}
              />
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Sub-components ---

function GroupSeparator() {
  return <div className="bg-border/50 my-1 w-px self-stretch" />;
}

interface DataColumnProps {
  label: string;
  value: string;
  unit: string;
  valueColor?: string;
  /** Selected (autopilot dial) value, shown next to the label as a bug. */
  target?: string;
  /** Related smaller reading rendered under the value. */
  secondary?: ReactNode;
}

function DataColumn({ label, value, unit, valueColor, target, secondary }: DataColumnProps) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-3.5 items-center gap-1.5 text-[10px] tracking-wider uppercase">
        <span className="text-muted-foreground font-medium">{label}</span>
        {target !== undefined && (
          // Keyed by value: animates only when the autopilot dial changes,
          // never on the 10 Hz live updates.
          <motion.span
            key={target}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={quickFade}
            className="text-info flex items-center font-mono normal-case tabular-nums"
          >
            <ChevronRight className="h-2.5 w-2.5" />
            {target}
          </motion.span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-mono text-lg leading-6 font-semibold tabular-nums',
            valueColor || 'text-foreground'
          )}
        >
          {value}
        </span>
        <span className="text-muted-foreground text-[10px]">{unit}</span>
      </div>
      <div className="text-muted-foreground h-3.5 font-mono text-[11px] leading-tight tabular-nums">
        {secondary}
      </div>
    </div>
  );
}
