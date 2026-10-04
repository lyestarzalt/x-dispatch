import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Crosshair, PictureInPicture2, Plane, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { Button } from '@/components/ui/button';
import { useUnits } from '@/hooks/useUnits';
import { exitEase, panelSpring, quickFade } from '@/lib/motionPresets';
import type { Feet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { FeetPerMinute, Knots } from '@/lib/utils/units';
import { useMapStore } from '@/stores/mapStore';
import { usePlaneStore } from '@/stores/planeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDragPosition } from '../hooks/useDragPosition';

const PRIMARY_COLOR_CLASS = 'text-primary';

interface FlightStripProps {
  onCenterPlane: () => void;
  /** Shown in its own window: the window moves and sizes it, no map actions. */
  detached?: boolean;
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

function formatNavFrequency(freq: number | undefined): string {
  if (freq === undefined || isNaN(freq) || freq <= 0) return '---.--';
  return (freq / 100).toFixed(2);
}

/** fpm reads in steps of 100, m/s with one decimal; both carry an explicit sign. */
function formatVS(vs: number | undefined, metric: boolean): string {
  if (vs === undefined || isNaN(vs)) return '---';
  const rounded = metric ? Math.round(vs * 10) / 10 : Math.round(vs / 100) * 100;
  if (rounded === 0) return '0';
  const text = metric ? rounded.toFixed(1) : formatValue(rounded);
  return rounded > 0 ? `+${text}` : text;
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

const noopPosition = () => {};

/** Whether the detached strip window is open; main pushes every change. */
function useStripWindowOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    window.appAPI
      .isFlightStripWindowOpen()
      .then(setOpen)
      .catch(() => {});
    return window.appAPI.onFlightStripWindowOpen(setOpen);
  }, []);
  return open;
}

/** The detached window shows the strip in place and must never rewrite the saved map position. */
function useStripDrag(detached: boolean) {
  const position = useMapStore((s) => s.flightStripPosition);
  const setPosition = useMapStore((s) => s.setFlightStripPosition);
  return useDragPosition(detached ? null : position, detached ? noopPosition : setPosition);
}

// --- Main component ---

export default function FlightStrip({ onCenterPlane, detached = false }: FlightStripProps) {
  const planeState = usePlaneStore((s) => s.state);
  const connected = usePlaneStore((s) => s.connected);
  const { t } = useTranslation();
  const followPlane = useMapStore((s) => s.followPlane);
  const stripWindowOpen = useStripWindowOpen();
  const { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick } =
    useStripDrag(detached);
  const units = useSettingsStore((s) => s.map.units);
  const settingsScale = useSettingsStore((s) => s.appearance.flightStripScale);
  // The detached window scales the strip to its own size instead.
  const scale = detached ? 1 : settingsScale;
  const { speedF, altitudeF, verticalSpeedF } = useUnits();
  const speed = (kts: number | undefined) => (kts === undefined ? undefined : speedF(kts as Knots));
  const altitude = (ft: number | undefined) =>
    ft === undefined ? undefined : altitudeF(ft as Feet);
  const verticalSpeed = (fpm: number | undefined) =>
    fpm === undefined ? undefined : verticalSpeedF(fpm as FeetPerMinute);
  const metricVS = units.verticalSpeed === 'ms';
  const formatVerticalSpeed = (vs: number | undefined) => formatVS(vs, metricVS);

  const handleCenter = () => {
    if (hasDragged.current) return;
    onCenterPlane();
  };

  const isDefault = detached || position === null;

  return (
    <AnimatePresence>
      {(connected || detached) && (
        <motion.div
          ref={stripRef}
          className={cn(
            'z-20 select-none',
            isDefault && !detached && 'absolute bottom-4 left-1/2',
            !isDefault && 'fixed'
          )}
          style={{
            // Centering stays a plain style transform so dragging never animates it.
            x: isDefault && !detached ? '-50%' : 0,
            ...(!isDefault ? { left: position.x, top: position.y } : undefined),
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: exitEase }}
          transition={panelSpring}
          onMouseDown={detached ? undefined : handleMouseDown}
          onDoubleClick={detached ? undefined : handleDoubleClick}
        >
          <div
            className={cn(
              'flex items-center rounded-xl border',
              'border-border/50 bg-card/90 shadow-2xl shadow-black/50',
              'backdrop-blur-xl',
              !detached && 'cursor-grab active:cursor-grabbing'
            )}
            style={{ zoom: scale }}
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

            {planeState?.pitch !== undefined && planeState?.roll !== undefined && (
              <>
                <div className="flex items-center px-2.5 py-1">
                  <MiniAttitude pitch={planeState.pitch} roll={planeState.roll} />
                </div>
                <GroupSeparator />
              </>
            )}

            {/* Five columns: the values you fly with are large, related
                secondary readings sit underneath in a muted line. */}
            <div className="flex items-center gap-4 px-4 py-1.5">
              <DataColumn
                label={t('flightStrip.ias')}
                target={
                  planeState?.apAirspeedIsMach
                    ? formatTarget(formatMach, planeState.apAirspeed)
                    : formatTarget(formatValue, speed(planeState?.apAirspeed))
                }
                value={formatValue(speed(planeState?.indicatedAirspeed))}
                unit={t(`units.${units.speed}`)}
                valueColor={PRIMARY_COLOR_CLASS}
                secondary={`${t('flightStrip.gs')} ${formatValue(speed(planeState?.groundspeed))} · ${t('flightStrip.mach')} ${formatMach(planeState?.mach)}`}
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.alt')}
                target={formatTarget(formatValue, altitude(planeState?.apAltitude))}
                value={formatValue(altitude(planeState?.altitudeMSL))}
                unit={t(`units.${units.altitude}`)}
                valueColor={PRIMARY_COLOR_CLASS}
                secondary={
                  <span className={cn(isLowAGL(planeState?.altitudeAGL) && 'text-warning')}>
                    {t('flightStrip.agl')} {formatValue(altitude(planeState?.altitudeAGL))}
                  </span>
                }
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.vs')}
                target={formatTarget(
                  formatVerticalSpeed,
                  verticalSpeed(planeState?.apVerticalSpeed)
                )}
                value={formatVerticalSpeed(verticalSpeed(planeState?.verticalSpeed))}
                unit={t(`units.${units.verticalSpeed}`)}
                valueColor={getVSColor(planeState?.verticalSpeed)}
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.hdg')}
                target={formatTarget(formatHeading, planeState?.apHeading)}
                value={formatHeading(planeState?.heading)}
                unit="°"
                valueColor={PRIMARY_COLOR_CLASS}
                secondary={`${t('flightStrip.crs')} ${formatHeading(planeState?.nav1Course)}° · ${t('flightStrip.nav1')} ${formatNavFrequency(planeState?.nav1Frequency)}`}
              />

              <GroupSeparator />

              <DataColumn
                label={t('flightStrip.wind')}
                value={formatWind(planeState?.windDirection, speed(planeState?.windSpeed))}
                unit={t(`units.${units.speed}`)}
                secondary={`${t('flightStrip.oat')} ${formatOAT(planeState?.oat)}°C`}
              />
            </div>

            <GroupSeparator />

            {/* Center / Follow and pop-out buttons; the detached window has neither */}
            {!detached && (
              <div className="flex items-center gap-0.5 px-1.5 py-1.5">
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
                <DesktopOnly>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-8 rounded-lg px-2"
                    onClick={() => void window.appAPI.openFlightStripWindow()}
                    tooltip={
                      stripWindowOpen ? t('flightStrip.closeWindow') : t('flightStrip.detach')
                    }
                  >
                    {stripWindowOpen ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <PictureInPicture2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </DesktopOnly>
              </div>
            )}
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

// --- Mini attitude indicator ---

const ADI_RADIUS = 19;
const ADI_PX_PER_DEG = 0.8;
const ADI_MAX_PITCH_DEG = 18;
const ADI_MAX_ROLL_DEG = 75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Minimal artificial horizon. Samples arrive at 10 Hz; a short linear CSS
 * transition on the transform glides between them, so it stays smooth with
 * no per-frame JS.
 */
function MiniAttitude({ pitch, roll }: { pitch: number | undefined; roll: number | undefined }) {
  if (pitch === undefined || roll === undefined || isNaN(pitch) || isNaN(roll)) return null;

  const pitchPx = clamp(pitch, -ADI_MAX_PITCH_DEG, ADI_MAX_PITCH_DEG) * ADI_PX_PER_DEG;
  const rollDeg = clamp(roll, -ADI_MAX_ROLL_DEG, ADI_MAX_ROLL_DEG);

  return (
    <svg
      width={ADI_RADIUS * 2 + 2}
      height={ADI_RADIUS * 2 + 2}
      viewBox="-20 -20 40 40"
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <clipPath id="flight-strip-adi-clip">
          <circle r={ADI_RADIUS} />
        </clipPath>
      </defs>
      <g clipPath="url(#flight-strip-adi-clip)">
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            // rotate first so the pitch offset moves perpendicular to the horizon
            transform: `rotate(${-rollDeg}deg) translateY(${pitchPx}px)`,
            transition: 'transform 120ms linear',
          }}
        >
          <rect x={-60} y={-100} width={120} height={100} fill="#39597e" />
          <rect x={-60} y={0} width={120} height={100} fill="#6b4a2b" />
          <rect x={-60} y={-0.5} width={120} height={1} fill="#e7e5e4" />
          <rect x={-7} y={-8.3} width={14} height={0.6} fill="#e7e5e4" opacity={0.55} />
          <rect x={-7} y={7.7} width={14} height={0.6} fill="#e7e5e4" opacity={0.55} />
        </g>
      </g>
      {/* fixed miniature aircraft */}
      <path
        d="M -9 0 L -3.5 0 L -1.8 2.4 L 0 0 L 1.8 2.4 L 3.5 0 L 9 0"
        fill="none"
        stroke="#fbbf24"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle r={ADI_RADIUS} fill="none" strokeWidth={1} className="stroke-border" />
    </svg>
  );
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
