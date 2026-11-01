import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, PictureInPicture2, Plane } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { Button } from '@/components/ui/button';
import { useUnits } from '@/hooks/useUnits';
import type { FlightStripReadout } from '@/lib/flightStrip/fields';
import {
  ADJUSTABLE_READOUTS,
  type AdjustProfile,
  type AdjustableReadout,
  COM1_FLIP_COMMAND,
  adjustCommand,
  pickAdjustProfile,
  wheelSteps,
} from '@/lib/flightStrip/wheelAdjust';
import { exitEase, panelSpring, quickFade } from '@/lib/motionPresets';
import type { Feet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { FeetPerMinute, Knots, SpeedUnit } from '@/lib/utils/units';
import { useFlightStripWindowOpen } from '@/queries';
import { useMapStore } from '@/stores/mapStore';
import { usePlaneStore } from '@/stores/planeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDragPosition } from '../hooks/useDragPosition';
import TaxiGuidanceRow from './TaxiGuidanceRow';

interface FlightStripProps {
  onCenterPlane: () => void;
  /** Shown in its own window: the window moves and sizes it, no map actions. */
  detached?: boolean;
  /** Buttons at the right end of the detached strip, where the map strip has its own. */
  actions?: ReactNode;
  /** Shown at the bottom of the strip's card, under the taxi guidance. */
  footer?: ReactNode;
}

type WheelAdjustHandler = (direction: 1 | -1, coarse: boolean) => void;

/**
 * Scrolling over a readout turns its knob in X-Plane. Off while the sim is away,
 * when the pilot switched it off, and for autopilot values whose bug is hidden,
 * since a knob you cannot see turning is a knob you turn by accident.
 */
function useWheelAdjust(enabled: boolean, targetsShown: boolean) {
  const connected = usePlaneStore((s) => s.connected);
  const icaoType = usePlaneStore((s) => s.state?.icaoType);
  const aircraftName = usePlaneStore((s) => s.state?.aircraftName);
  // Which aircraft's knobs to turn: looked up again whenever the loaded aircraft
  // changes. The answer is tagged with the aircraft it was found for, so a stale one
  // never applies to the next aircraft while its lookup is still running.
  const aircraftKey = enabled && connected && icaoType ? `${icaoType}|${aircraftName ?? ''}` : '';
  const [found, setFound] = useState<{ key: string; profile: AdjustProfile | null }>();
  useEffect(() => {
    if (!aircraftKey) return;
    let cancelled = false;
    void pickAdjustProfile({ icaoType, aircraftName }, (name) =>
      window.xplaneServiceAPI.commandExists(name)
    ).then((profile) => {
      if (!cancelled) setFound({ key: aircraftKey, profile });
    });
    return () => {
      cancelled = true;
    };
  }, [aircraftKey, icaoType, aircraftName]);
  const profile = found?.key === aircraftKey ? found.profile : null;

  return useCallback(
    (readout: AdjustableReadout): WheelAdjustHandler | undefined => {
      if (!enabled || !connected) return undefined;
      const isAutopilot = readout !== 'com1' && readout !== 'qnh';
      if (isAutopilot && !targetsShown) return undefined;
      return (direction, coarse) => {
        void window.xplaneServiceAPI.activateCommand(
          adjustCommand(readout, direction, coarse, profile),
          0
        );
      };
    },
    [enabled, connected, targetsShown, profile]
  );
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

/** fpm reads in steps of 100, m/s with one decimal; both carry an explicit sign. */
function formatVS(vs: number | undefined, metric: boolean): string {
  if (vs === undefined || isNaN(vs)) return '---';
  const rounded = metric ? Math.round(vs * 10) / 10 : Math.round(vs / 100) * 100;
  if (rounded === 0) return '0';
  const text = metric ? rounded.toFixed(1) : formatValue(rounded);
  return rounded > 0 ? `+${text}` : text;
}

/** The dataref holds kHz; aircraft without a COM radio leave junk in it, so only the COM band shows. */
function formatComFrequency(khz: number | undefined): string {
  if (khz === undefined || isNaN(khz) || khz < 118_000 || khz > 137_000) return '---.---';
  return (khz / 1000).toFixed(3);
}

const HPA_PER_INHG = 33.8639;

function formatQnhHpa(inHg: number | undefined): string {
  if (inHg === undefined || isNaN(inHg) || inHg <= 0) return '----';
  return Math.round(inHg * HPA_PER_INHG).toString();
}

function formatInHg(inHg: number | undefined): string {
  if (inHg === undefined || isNaN(inHg) || inHg <= 0) return '--.--';
  return inHg.toFixed(2);
}

/** Written as on a PFD: ".78", the leading zero dropped. */
function formatMach(mach: number | undefined): string {
  if (mach === undefined || isNaN(mach)) return '---';
  return mach.toFixed(2).replace(/^0\./, '.');
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

/**
 * Widest text each formatter produces, in mono characters. A reading reserves
 * that width so live values never resize the strip; add one with each formatter.
 */
const ALTITUDE_CHARS = 6; // 45,000
const HEADING_CHARS = 3;
const WIND_CHARS = 6; // 270/35
const OAT_CHARS = 3; // -45
const MACH_CHARS = 4; // 1.02
const COM_FREQUENCY_CHARS = 7; // 118.805
const QNH_CHARS = 4; // 1013
const INHG_CHARS = 5; // 29.92
/** Speed in km/h passes 1,000 with its separator; knots and mph stay in three digits. */
const speedChars = (unit: SpeedUnit) => (unit === 'kmh' ? 5 : 3);
/** -6,000 fpm or -25.0 m/s */
const verticalSpeedChars = (metric: boolean) => (metric ? 5 : 6);

function isLowAGL(agl: number | undefined): boolean {
  return agl !== undefined && !isNaN(agl) && agl < 500;
}

const noopPosition = () => {};

/** The detached window shows the strip in place and must never rewrite the saved map position. */
function useStripDrag(detached: boolean) {
  const position = useMapStore((s) => s.flightStripPosition);
  const setPosition = useMapStore((s) => s.setFlightStripPosition);
  return useDragPosition(detached ? null : position, detached ? noopPosition : setPosition);
}

// --- Main component ---

export default function FlightStrip({
  onCenterPlane,
  detached = false,
  actions,
  footer,
}: FlightStripProps) {
  const planeState = usePlaneStore((s) => s.state);
  const connected = usePlaneStore((s) => s.connected);
  const { t } = useTranslation();
  const followPlane = useMapStore((s) => s.followPlane);
  const stripWindowOpen = useFlightStripWindowOpen();
  const fields = useSettingsStore((s) => s.flightStrip.fields);
  const order = useSettingsStore((s) => s.flightStrip.order);
  const { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick } =
    useStripDrag(detached);
  const units = useSettingsStore((s) => s.map.units);
  const settingsScale = useSettingsStore((s) => s.flightStrip.scale);
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
  const speedWidth = speedChars(units.speed);
  const vsWidth = verticalSpeedChars(metricVS);

  const handleCenter = () => {
    if (hasDragged.current) return;
    onCenterPlane();
  };

  const isDefault = detached || position === null;

  // Autopilot bugs and the muted line under each value follow their own toggles.
  const target = (value: string | undefined) => (fields.targets ? value : undefined);
  const details = fields.details;
  const wheelAdjust = useSettingsStore((s) => s.flightStrip.wheelAdjust);
  const adjust = useWheelAdjust(wheelAdjust, fields.targets);
  const onAdjust = Object.fromEntries(ADJUSTABLE_READOUTS.map((r) => [r, adjust(r)])) as Record<
    AdjustableReadout,
    WheelAdjustHandler | undefined
  >;
  const adjustHint = t('flightStrip.scrollToAdjust');
  const flipCom1 = () => void window.xplaneServiceAPI.activateCommand(COM1_FLIP_COMMAND, 0);
  // One node per readout that is on; the pilot's order picks them out below.
  const readouts: Partial<Record<FlightStripReadout, ReactNode>> = {};
  if (fields.attitude && planeState?.pitch !== undefined && planeState?.roll !== undefined) {
    readouts.attitude = <MiniAttitude pitch={planeState.pitch} roll={planeState.roll} />;
  }
  if (fields.speed) {
    readouts.speed = (
      <DataColumn
        label={t('flightStrip.ias')}
        onWheelAdjust={onAdjust.speed}
        adjustHint={adjustHint}
        target={target(
          planeState?.apAirspeedIsMach
            ? formatTarget(formatMach, planeState.apAirspeed)
            : formatTarget(formatValue, speed(planeState?.apAirspeed))
        )}
        value={
          <Reading chars={speedWidth}>{formatValue(speed(planeState?.indicatedAirspeed))}</Reading>
        }
        unit={t(`units.${units.speed}`)}
        showDetails={details}
        secondary={
          <>
            {t('flightStrip.gs')}{' '}
            <Reading align="left" chars={speedWidth}>
              {formatValue(speed(planeState?.groundspeed))}
            </Reading>
            <span className="inline-block w-2" />
            {t('flightStrip.mach')}{' '}
            <Reading align="left" chars={MACH_CHARS}>
              {formatMach(planeState?.mach)}
            </Reading>
          </>
        }
      />
    );
  }
  if (fields.altitude) {
    readouts.altitude = (
      <DataColumn
        label={t('flightStrip.alt')}
        onWheelAdjust={onAdjust.altitude}
        adjustHint={adjustHint}
        target={target(formatTarget(formatValue, altitude(planeState?.apAltitude)))}
        value={
          <Reading chars={ALTITUDE_CHARS}>{formatValue(altitude(planeState?.altitudeMSL))}</Reading>
        }
        unit={t(`units.${units.altitude}`)}
        showDetails={details}
        secondary={
          <span className={cn(isLowAGL(planeState?.altitudeAGL) && 'text-warning')}>
            {t('flightStrip.agl')}{' '}
            <Reading align="left" chars={ALTITUDE_CHARS}>
              {formatValue(altitude(planeState?.altitudeAGL))}
            </Reading>
          </span>
        }
      />
    );
  }
  if (fields.verticalSpeed) {
    readouts.verticalSpeed = (
      <DataColumn
        label={t('flightStrip.vs')}
        onWheelAdjust={onAdjust.verticalSpeed}
        adjustHint={adjustHint}
        target={target(
          formatTarget(formatVerticalSpeed, verticalSpeed(planeState?.apVerticalSpeed))
        )}
        value={
          <Reading chars={vsWidth}>
            {formatVerticalSpeed(verticalSpeed(planeState?.verticalSpeed))}
          </Reading>
        }
        unit={t(`units.${units.verticalSpeed}`)}
        showDetails={details}
      />
    );
  }
  if (fields.heading) {
    readouts.heading = (
      <DataColumn
        label={t('flightStrip.hdg')}
        onWheelAdjust={onAdjust.heading}
        adjustHint={adjustHint}
        target={target(formatTarget(formatHeading, planeState?.apHeading))}
        value={
          <Reading chars={HEADING_CHARS}>{formatHeading(planeState?.magneticHeading)}</Reading>
        }
        unit="°"
        showDetails={details}
        secondary={
          <>
            {t('flightStrip.trk')}{' '}
            <Reading align="left" chars={HEADING_CHARS}>
              {formatHeading(planeState?.groundTrack)}
            </Reading>
            °<span className="inline-block w-2" />
            {t('flightStrip.crs')}{' '}
            <Reading align="left" chars={HEADING_CHARS}>
              {formatHeading(planeState?.nav1Course)}
            </Reading>
            °
          </>
        }
      />
    );
  }
  if (fields.wind) {
    readouts.wind = (
      <DataColumn
        label={t('flightStrip.wind')}
        value={
          <Reading chars={WIND_CHARS}>
            {formatWind(planeState?.windDirection, planeState?.windSpeed)}
          </Reading>
        }
        unit={t('units.kt')}
        showDetails={details}
        secondary={
          <>
            {t('flightStrip.oat')}{' '}
            <Reading align="left" chars={OAT_CHARS}>
              {formatOAT(planeState?.oat)}
            </Reading>
            °C
          </>
        }
      />
    );
  }
  if (fields.com1) {
    readouts.com1 = (
      <DataColumn
        label={t('flightStrip.com1')}
        onWheelAdjust={onAdjust.com1}
        onActivate={onAdjust.com1 ? flipCom1 : undefined}
        adjustHint={t('flightStrip.scrollToTune')}
        value={
          <Reading chars={COM_FREQUENCY_CHARS}>
            <FrequencyDigits text={formatComFrequency(planeState?.com1Frequency)} />
          </Reading>
        }
        unit={t('units.mhz')}
        showDetails={details}
        secondary={
          <>
            {t('flightStrip.stby')}{' '}
            <Reading align="left" chars={COM_FREQUENCY_CHARS}>
              <FrequencyDigits text={formatComFrequency(planeState?.com1StandbyFrequency)} />
            </Reading>
          </>
        }
      />
    );
  }
  if (fields.qnh) {
    readouts.qnh = (
      <DataColumn
        label={t('flightStrip.qnh')}
        onWheelAdjust={onAdjust.qnh}
        adjustHint={adjustHint}
        value={<Reading chars={QNH_CHARS}>{formatQnhHpa(planeState?.baroSettingInHg)}</Reading>}
        unit={t('units.hpa')}
        showDetails={details}
        secondary={
          <>
            <Reading align="left" chars={INHG_CHARS}>
              {formatInHg(planeState?.baroSettingInHg)}
            </Reading>{' '}
            {t('units.inhg')}
          </>
        }
      />
    );
  }
  const columns = order.flatMap((readout) => {
    const node = readouts[readout];
    return node === undefined ? [] : [{ key: readout, node }];
  });

  return (
    <AnimatePresence>
      {/* Popped out, the window replaces the map strip; closing it brings the strip back */}
      {(detached || (connected && !stripWindowOpen)) && (
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
              'flex flex-col rounded-lg border',
              'border-border/50 bg-card/90',
              'backdrop-blur-xl',
              !detached && 'cursor-grab active:cursor-grabbing'
            )}
            style={{ zoom: scale }}
          >
            <div className="flex items-center">
              {/* Status indicator */}
              <div className="flex items-center gap-1.5 px-3 py-2">
                <div className="bg-success h-2 w-2 animate-pulse rounded-full" />
                <Plane className="text-primary h-3.5 w-3.5" />
                {fields.aircraft && (planeState?.icaoType || planeState?.tailNumber) && (
                  <div
                    className="flex flex-col leading-tight"
                    title={planeState?.aircraftName || undefined}
                  >
                    <span className="text-foreground font-mono text-xs font-medium">
                      {planeState?.icaoType}
                    </span>
                    <span className="text-muted-foreground text-2xs font-mono">
                      {planeState?.tailNumber}
                    </span>
                  </div>
                )}
              </div>

              <GroupSeparator />

              {/* The readouts in the pilot's order: the values you fly with are
                large, related secondary readings sit underneath in a muted line. */}
              {columns.length > 0 && (
                <div className="flex items-center gap-4 px-4 py-1.5">
                  {columns.map(({ key, node }, index) => (
                    <Fragment key={key}>
                      {index > 0 && <GroupSeparator />}
                      {node}
                    </Fragment>
                  ))}
                </div>
              )}

              {!detached && <GroupSeparator />}

              {/* Small window buttons stacked in the top-right corner */}
              {detached && actions && <div className="self-start py-0.5 pr-0.5">{actions}</div>}

              {/* Center / Follow and pop-out buttons; the detached window has neither */}
              {!detached && (
                <div className="flex items-center gap-0.5 px-1.5 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCenter}
                    className={cn('h-8 rounded-lg px-2.5', followPlane && 'bg-info/20 text-info')}
                    tooltip={
                      followPlane
                        ? t('flightStrip.followingTooltip')
                        : t('flightStrip.centerTooltip')
                    }
                  >
                    <Crosshair className={cn('h-3.5 w-3.5', followPlane && 'animate-pulse')} />
                    {followPlane ? t('flightStrip.following') : t('flightStrip.center')}
                  </Button>
                  <DesktopOnly>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-8 rounded-lg px-2"
                      onClick={() => void window.appAPI.openFlightStripWindow()}
                      tooltip={t('flightStrip.detach')}
                    >
                      <PictureInPicture2 className="h-3.5 w-3.5" />
                    </Button>
                  </DesktopOnly>
                </div>
              )}
            </div>

            {/* Turn-by-turn taxi guidance, on the ground with a planned route */}
            <TaxiGuidanceRow />
            {footer}
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

/** Attitude indicator colours: blue sky over brown ground in every theme, as on a real ADI. */
const ADI_SKY = '#39597e';
const ADI_GROUND = '#6b4a2b';
const ADI_HORIZON = '#e7e5e4';

const ADI_RADIUS = 19;
const ADI_PX_PER_DEG = 0.8;
const ADI_MAX_PITCH_DEG = 18;
const ADI_MAX_ROLL_DEG = 75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Size of the sky and ground layer; large enough to cover the dial at any roll and pitch. */
const ADI_LAYER_WIDTH = 120;
const ADI_LAYER_HEIGHT = 200;
const ADI_SIZE = ADI_RADIUS * 2 + 2;

/**
 * Minimal artificial horizon. Samples arrive at 10 Hz; a short linear CSS
 * transition on the transform glides between them, so it stays smooth with
 * no per-frame JS. The moving sky and ground are an HTML layer, not SVG: the
 * compositor runs an HTML transform transition on its own, while an SVG one
 * restyles and lays out the page on every frame.
 */
function MiniAttitude({ pitch, roll }: { pitch: number | undefined; roll: number | undefined }) {
  if (pitch === undefined || roll === undefined || isNaN(pitch) || isNaN(roll)) return null;

  const pitchPx = clamp(pitch, -ADI_MAX_PITCH_DEG, ADI_MAX_PITCH_DEG) * ADI_PX_PER_DEG;
  const rollDeg = clamp(roll, -ADI_MAX_ROLL_DEG, ADI_MAX_ROLL_DEG);
  const horizonY = ADI_LAYER_HEIGHT / 2;
  const centerX = ADI_LAYER_WIDTH / 2;

  return (
    <div className="relative shrink-0" style={{ width: ADI_SIZE, height: ADI_SIZE }} aria-hidden>
      <div
        className="absolute overflow-hidden rounded-full"
        style={{ inset: ADI_SIZE / 2 - ADI_RADIUS }}
      >
        <div
          className="absolute"
          style={{
            width: ADI_LAYER_WIDTH,
            height: ADI_LAYER_HEIGHT,
            left: ADI_RADIUS - centerX,
            top: ADI_RADIUS - horizonY,
            background: `linear-gradient(to bottom, ${ADI_SKY} 50%, ${ADI_GROUND} 50%)`,
            // rotate first so the pitch offset moves perpendicular to the horizon
            transform: `rotate(${-rollDeg}deg) translateY(${pitchPx}px)`,
            transition: 'transform 120ms linear',
            willChange: 'transform',
          }}
        >
          <div
            className="absolute inset-x-0"
            style={{ top: horizonY - 0.5, height: 1, background: ADI_HORIZON }}
          />
          {[-8, 8].map((y) => (
            <div
              key={y}
              className="absolute"
              style={{
                left: centerX - 7,
                top: horizonY + y - 0.3,
                width: 14,
                height: 0.6,
                background: ADI_HORIZON,
                opacity: 0.55,
              }}
            />
          ))}
        </div>
      </div>
      <svg width={ADI_SIZE} height={ADI_SIZE} viewBox="-20 -20 40 40" className="absolute inset-0">
        {/* fixed miniature aircraft */}
        <path
          d="M -9 0 L -3.5 0 L -1.8 2.4 L 0 0 L 1.8 2.4 L 3.5 0 L 9 0"
          fill="none"
          className="stroke-cat-amber"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle r={ADI_RADIUS} fill="none" strokeWidth={1} className="stroke-border" />
      </svg>
    </div>
  );
}

/** Marks the part of a reading whose wheel steps are the coarse ones. */
const COARSE_STEP_ATTR = 'data-coarse-step';

/** A frequency split at the dot, so the wheel steps MHz over the left digits and kHz over the right. */
function FrequencyDigits({ text }: { text: string }) {
  const dot = text.indexOf('.');
  if (dot === -1) return text;
  return (
    <>
      <span {...{ [COARSE_STEP_ATTR]: '' }}>{text.slice(0, dot)}</span>
      {text.slice(dot)}
    </>
  );
}

interface ReadingProps {
  /** Mono characters of the widest value this reading shows. */
  chars: number;
  /** Big values keep their digits anchored at the right; a reading after a label stays next to it. */
  align?: 'right' | 'left';
  children: ReactNode;
}

/**
 * One number in a box as wide as its widest value, so live readings never resize
 * the strip. Inherits the font it sits in: `ch` is one glyph there, as the strip's
 * readings are mono with tabular numerals.
 */
function Reading({ chars, align = 'right', children }: ReadingProps) {
  return (
    <span
      className={cn('inline-block tabular-nums', align === 'right' ? 'text-right' : 'text-left')}
      style={{ minWidth: `${chars}ch` }}
    >
      {children}
    </span>
  );
}

interface DataColumnProps {
  label: string;
  /** The large live value, a `Reading` or anything else that keeps its width. */
  value: ReactNode;
  unit: string;
  /** Selected (autopilot dial) value, shown above the live digits as a bug. */
  target?: string;
  /** Related smaller reading rendered under the value. */
  secondary?: ReactNode;
  /** Off drops the line under the value, so the strip gets shorter. */
  showDetails?: boolean;
  /** Set when scrolling over the column should turn its knob in the sim. */
  onWheelAdjust?: WheelAdjustHandler;
  /** A click on the column, for a knob with a push action such as the COM swap. */
  onActivate?: () => void;
  adjustHint?: string;
}

/** The detached window drags by the strip; a column that takes the wheel must not. */
const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

/**
 * PFD colours: live values white, the selected autopilot value magenta and placed
 * over the digits like a bug on the tape, with the label at the left of that row.
 */
function DataColumn({
  label,
  value,
  unit,
  target,
  secondary,
  showDetails = true,
  onWheelAdjust,
  onActivate,
  adjustHint,
}: DataColumnProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const carryRef = useRef(0);
  const adjustable = onWheelAdjust !== undefined;
  // A native, non-passive listener: the map under the docked strip zooms on wheel,
  // and React's own handler fires too late to stop it.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !onWheelAdjust) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Shift turns a vertical wheel into horizontal travel on Windows.
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      const { steps, carry } = wheelSteps(carryRef.current, delta);
      carryRef.current = carry;
      const direction = steps < 0 ? 1 : -1;
      const coarse =
        e.shiftKey ||
        (e.target instanceof Element && e.target.closest(`[${COARSE_STEP_ATTR}]`) !== null);
      for (let i = 0; i < Math.abs(steps); i++) onWheelAdjust(direction, coarse);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheelAdjust]);

  return (
    <div
      ref={rootRef}
      className={cn('flex min-w-0 flex-col items-start', adjustable && 'cursor-ns-resize')}
      style={adjustable ? noDragStyle : undefined}
      title={adjustable ? adjustHint : undefined}
      onClick={onActivate}
    >
      {/* The first column is as wide as the digits or the label row, whichever is wider,
        so the target's right edge always sits over the digits' right edge. */}
      <div className="grid grid-cols-[auto_auto] items-baseline gap-x-1">
        <div className="text-2xs flex h-3.5 items-center justify-between gap-2 tracking-wider uppercase">
          <span className="text-muted-foreground font-medium">{label}</span>
          {target !== undefined && (
            // Keyed by value: animates only when the autopilot dial changes,
            // never on the 10 Hz live updates.
            <motion.span
              key={target}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={quickFade}
              className="text-cat-fuchsia font-mono font-medium normal-case tabular-nums"
            >
              {target}
            </motion.span>
          )}
        </div>
        <span />
        <span className="text-foreground block text-right font-mono text-lg leading-6 font-semibold">
          {value}
        </span>
        <span className="text-muted-foreground text-2xs">{unit}</span>
      </div>
      {showDetails && (
        <div className="text-muted-foreground h-3.5 font-mono text-xs leading-tight">
          {secondary}
        </div>
      )}
    </div>
  );
}
