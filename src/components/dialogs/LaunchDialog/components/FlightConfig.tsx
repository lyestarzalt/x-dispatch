import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Power, PowerOff, Weight } from 'lucide-react';
import tzLookup from 'tz-lookup';
import { AirStartSpeedInput } from '@/components/AirStartSpeedInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IcaoCode } from '@/components/ui/icao-code';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnits } from '@/hooks/useUnits';
import { airSpeedFromMs, isValidAirStartSpeed } from '@/lib/utils/airStartSpeed';
import { type NauticalMiles, metersToFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '../types';
import { getWeatherSummary } from '../weatherTypes';
import { ConditionsCard } from './ConditionsCard';
import { WeatherDialog } from './WeatherDialog';
import { WeightBalanceDialog } from './WeightBalanceDialog';
import { WeightLegendItem } from './WeightLegendItem';
import { LAUNCH_CHOICE } from './choiceStyle';

/** X-Plane's default air start, 3,000 ft. */
const DEFAULT_AIR_ALTITUDE_M = 914.4;

interface FlightConfigProps {
  startPosition: StartPosition | null;
  isXPlaneRunning: boolean;
  onLaunch: () => void;
  aircraftList: Aircraft[];
}

function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    return offsetPart?.value?.replace('GMT', 'UTC') || '';
  } catch {
    return '';
  }
}

export function FlightConfig({
  startPosition,
  isXPlaneRunning,
  onLaunch,
  aircraftList,
}: FlightConfigProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const isAirStart = startPosition?.type === 'custom' && startPosition.customStartMode === 'air';
  const invalidAirSpeed = isAirStart && !isValidAirStartSpeed(startPosition.airSpeedMs);

  // Get selected airport data for lat/lon (enriched with coordinates at parse time)
  const selectedAirportData = useAppStore((s) => s.selectedAirportData);

  // Get airport coordinates - prefer startPosition, fall back to airport coords
  const airportCoords = useMemo(() => {
    if (startPosition) {
      return { latitude: startPosition.latitude, longitude: startPosition.longitude };
    }
    if (selectedAirportData) {
      return { latitude: selectedAirportData.latitude, longitude: selectedAirportData.longitude };
    }
    return null;
  }, [startPosition, selectedAirportData]);

  // Zustand store state
  const selectedAircraft = useLaunchStore((s) => s.selectedAircraft);
  const selectedLivery = useLaunchStore((s) => s.selectedLivery);
  const tankPercentages = useLaunchStore((s) => s.tankPercentages);
  const payloadWeights = useLaunchStore((s) => s.payloadWeights);
  const timeOfDay = useLaunchStore((s) => s.timeOfDay);
  const useRealWorldTime = useLaunchStore((s) => s.useRealWorldTime);
  const coldAndDark = useLaunchStore((s) => s.coldAndDark);
  const weatherConfig = useLaunchStore((s) => s.weatherConfig);
  const isLaunching = useLaunchStore((s) => s.isLaunching);
  const launchError = useLaunchStore((s) => s.launchError);

  // Zustand store actions
  const setTimeOfDay = useLaunchStore((s) => s.setTimeOfDay);
  const setUseRealWorldTime = useLaunchStore((s) => s.setUseRealWorldTime);
  const setColdAndDark = useLaunchStore((s) => s.setColdAndDark);
  const setWeatherPreset = useLaunchStore((s) => s.setWeatherPreset);

  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weatherDialogOpen, setWeatherDialogOpen] = useState(false);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    if (!useRealWorldTime || !airportCoords) return;
    // Refresh immediately when toggled on so the user isn't stuck with the
    // previous frozen value for up to a minute.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [useRealWorldTime, airportCoords]);

  const airportTimeInfo = useMemo(() => {
    if (!airportCoords) return null;

    try {
      const timezone = tzLookup(airportCoords.latitude, airportCoords.longitude);
      const offset = getTimezoneOffset(timezone);

      const airportTimeStr = currentTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      });

      const airportDateStr = currentTime.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: timezone,
      });

      const utcTimeStr = currentTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      });

      const airportHours = parseInt(airportTimeStr.split(':')[0] ?? '0', 10);
      const isDay = airportHours >= 6 && airportHours < 18;

      const hours = airportHours + parseInt(airportTimeStr.split(':')[1] ?? '0', 10) / 60;
      return {
        hours,
        timeStr: airportTimeStr,
        dateStr: airportDateStr,
        utcStr: utcTimeStr,
        offset,
        isDay,
      };
    } catch {
      return null;
    }
  }, [airportCoords, currentTime]);

  const { totalWeight, totalFuelLbs, totalPayloadLbs } = useMemo(() => {
    if (!selectedAircraft) return { totalWeight: 0, totalFuelLbs: 0, totalPayloadLbs: 0 };
    const fuel = (selectedAircraft.tankRatios ?? []).reduce(
      (sum, r, i) => sum + r * selectedAircraft.maxFuel * ((tankPercentages[i] ?? 0) / 100),
      0
    );
    const payload = (payloadWeights ?? []).reduce((sum, w) => sum + w, 0);
    return {
      totalWeight: selectedAircraft.emptyWeight + fuel + payload,
      totalFuelLbs: fuel,
      totalPayloadLbs: payload,
    };
  }, [selectedAircraft, tankPercentages, payloadWeights]);

  const isOverweight = selectedAircraft ? totalWeight > selectedAircraft.maxWeight : false;

  // Derive weather toggle value
  const weatherValue =
    weatherConfig.mode === 'real'
      ? 'real'
      : weatherConfig.mode === 'preset'
        ? weatherConfig.preset
        : 'custom';

  return (
    <div className="border-border/50 bg-card flex w-[22rem] min-w-[320px] shrink-0 flex-col border-l lg:w-[24rem]">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="space-y-5 p-4">
          <ConditionsCard
            coords={airportCoords}
            timeOfDay={timeOfDay}
            live={airportTimeInfo}
            useRealWorldTime={useRealWorldTime}
            onModeChange={setUseRealWorldTime}
            onTimeChange={setTimeOfDay}
            weatherValue={weatherValue}
            onWeatherChange={(v) => {
              if (v === 'custom') setWeatherDialogOpen(true);
              else setWeatherPreset(v);
            }}
            customSummary={
              weatherConfig.mode === 'custom' ? getWeatherSummary(weatherConfig) : null
            }
            metarIcao={startPosition?.airport ?? selectedAirportData?.id ?? null}
          />

          {/* ── Weight & Fuel ──────────────────────────────── */}
          {/* The whole card opens weight & balance: one stretched button under the content */}
          <section
            className={cn(
              'relative space-y-2 rounded-lg border p-3 transition-colors',
              selectedAircraft
                ? 'border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/60 has-[button:focus-visible]:border-primary'
                : 'border-border/50'
            )}
          >
            {selectedAircraft && (
              <button
                type="button"
                className="absolute inset-0 rounded-lg focus-visible:outline-none"
                onClick={() => setWeightDialogOpen(true)}
                aria-label={`${t('common.edit')}: ${t('launcher.weightFuelLabel')}`}
              />
            )}
            <div className="pointer-events-none relative flex items-center justify-between gap-2">
              <span className="xp-label flex min-w-0 items-center gap-2">
                <Weight className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('launcher.weightFuelLabel')}</span>
              </span>
              {selectedAircraft && (
                <span className="text-primary flex shrink-0 items-center gap-0.5 text-xs font-medium">
                  {t('common.edit')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            {selectedAircraft && (
              <div className="pointer-events-none relative space-y-2">
                {/* Takeoff weight as a fraction of the maximum, so the bar under it reads as "this much of that" */}
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <span className="xp-label block text-xs">
                      {t('launcher.config.takeoffWeight')}
                    </span>
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span
                        className={cn(
                          'font-mono text-xl font-semibold tabular-nums',
                          isOverweight ? 'text-destructive' : 'text-foreground'
                        )}
                      >
                        {units.weight(totalWeight)}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground pointer-events-auto cursor-help truncate text-xs underline decoration-dotted underline-offset-2">
                            {t('launcher.config.ofMtow', {
                              max: units.weight(selectedAircraft.maxWeight),
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">
                          {t('launcher.config.maxHint')}
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      isOverweight ? 'text-destructive font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {isOverweight
                      ? t('launcher.config.overweight', {
                          amount: units.weight(totalWeight - selectedAircraft.maxWeight),
                        })
                      : t('launcher.config.spare', {
                          amount: units.weight(selectedAircraft.maxWeight - totalWeight),
                        })}
                  </span>
                </div>
                {/* The outlined track is MTOW; empty, payload and fuel fill it from the left */}
                <div
                  className={cn(
                    'flex h-2.5 w-full overflow-hidden rounded-full border',
                    isOverweight ? 'border-destructive' : 'border-border'
                  )}
                >
                  <div
                    className="bg-muted-foreground h-full"
                    style={{
                      width: `${(selectedAircraft.emptyWeight / selectedAircraft.maxWeight) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-success h-full"
                    style={{ width: `${(totalPayloadLbs / selectedAircraft.maxWeight) * 100}%` }}
                  />
                  <div
                    className={cn('h-full', isOverweight ? 'bg-destructive' : 'bg-primary')}
                    style={{ width: `${(totalFuelLbs / selectedAircraft.maxWeight) * 100}%` }}
                  />
                </div>
                {/* Legend in the gauge's order, one column each so values never wrap */}
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <WeightLegendItem
                    dotClass="bg-muted-foreground"
                    label={t('launcher.specs.emptyWeight')}
                    hint={t('launcher.config.emptyHint')}
                    value={units.weight(selectedAircraft.emptyWeight)}
                  />
                  <WeightLegendItem
                    dotClass="bg-success"
                    label={t('weightBalance.payload')}
                    hint={t('launcher.config.payloadHint')}
                    value={units.weight(totalPayloadLbs)}
                  />
                  <WeightLegendItem
                    dotClass={isOverweight ? 'bg-destructive' : 'bg-primary'}
                    label={t('launcher.config.fuel')}
                    hint={t('launcher.config.fuelHint')}
                    value={units.weight(totalFuelLbs)}
                  />
                </dl>
              </div>
            )}
          </section>

          {/* ── Start State ────────────────────────────────── */}
          <section className="space-y-2">
            <span className="xp-label flex min-w-0 items-center gap-2">
              <Power className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('launcher.config.startState')}</span>
            </span>
            <ToggleGroup
              type="single"
              value={coldAndDark ? 'cold' : 'ready'}
              onValueChange={(v) => {
                if (v) setColdAndDark(v === 'cold');
              }}
              className="grid grid-cols-2 gap-1.5"
            >
              <ToggleGroupItem
                value="ready"
                className={cn('h-auto gap-1.5 px-2 py-2 text-sm', LAUNCH_CHOICE)}
              >
                <Power className="h-4 w-4" />
                <span>{t('launcher.startState.ready')}</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="cold"
                className={cn('h-auto gap-1.5 px-2 py-2 text-sm', LAUNCH_CHOICE)}
              >
                <PowerOff className="h-4 w-4" />
                <span>{t('launcher.startState.cold')}</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </section>

          {/* ── Flight Summary ─────────────────────────────── */}
          {isAirStart && (
            <AirStartSpeedInput
              position={startPosition}
              onChange={(fields) =>
                useAppStore.getState().setStartPosition({ ...startPosition, ...fields })
              }
            />
          )}
        </div>

        {/* What will launch and the button that launches it: right after the settings, and
            pinned to the bottom edge only when the settings outgrow the panel. */}
        <div className="border-border/50 bg-card sticky bottom-0 space-y-3 border-t p-4">
          {/* What will launch: a last look before committing */}
          <dl className="bg-secondary/50 space-y-1.5 rounded-lg p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="xp-label shrink-0">{t('launcher.aircraft.title')}</dt>
              <dd className="text-foreground min-w-0 text-right">
                {selectedAircraft?.name || '—'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="xp-label shrink-0">{t('launcher.config.livery')}</dt>
              <dd className="text-foreground min-w-0 truncate text-right">{selectedLivery}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="xp-label shrink-0">{t('launcher.config.departure')}</dt>
              <dd className="min-w-0 text-right">
                {!startPosition ? (
                  <span className="text-muted-foreground">—</span>
                ) : startPosition.type === 'custom' ? (
                  <>
                    <span className="text-primary">
                      {t(`toolbar.pinModes.${startPosition.customStartMode ?? 'ground'}`)}
                    </span>
                    <div className="text-muted-foreground font-mono text-xs">
                      {units.coordinates(startPosition.latitude, startPosition.longitude)}
                    </div>
                  </>
                ) : (
                  <span className="text-foreground">
                    <IcaoCode className="text-primary">{startPosition.airport}</IcaoCode>{' '}
                    {startPosition.name}
                  </span>
                )}
                {startPosition?.approachDistanceNm != null && (
                  <div className="text-muted-foreground text-xs">
                    {t('airportInfo.runway.approachNm', {
                      distance: units.distance(startPosition.approachDistanceNm as NauticalMiles),
                    })}
                  </div>
                )}
                {startPosition?.towType && (
                  <div className="text-muted-foreground text-xs">
                    {t('airportInfo.runway.towWith', {
                      type: t(`airportInfo.runway.${startPosition.towType}`),
                    })}
                  </div>
                )}
                {startPosition?.customStartMode === 'air' && (
                  <div className="text-muted-foreground text-xs">
                    {units.altitude(
                      metersToFeet(startPosition.airAltitudeM ?? DEFAULT_AIR_ALTITUDE_M)
                    )}
                    {isValidAirStartSpeed(startPosition.airSpeedMs) &&
                      ` · ${Math.round(airSpeedFromMs(startPosition.airSpeedMs, startPosition.airSpeedUnit ?? 'kt'))} ${t(`units.${startPosition.airSpeedUnit ?? 'kt'}`)}`}
                  </div>
                )}
                {(startPosition?.customStartMode === 'carrier' ||
                  startPosition?.customStartMode === 'frigate') && (
                  <div className="text-muted-foreground text-xs">
                    {startPosition.boatPosition
                      ? t(`toolbar.pinModes.cat_${startPosition.boatPosition}`)
                      : startPosition.boatApproachNm
                        ? units.distance(startPosition.boatApproachNm as NauticalMiles)
                        : ''}
                  </div>
                )}
              </dd>
            </div>
          </dl>

          {launchError && (
            <Alert variant="destructive" className="p-2">
              <AlertDescription className="text-sm">{launchError}</AlertDescription>
            </Alert>
          )}

          <Button
            data-testid="confirm-launch"
            onClick={onLaunch}
            disabled={!selectedAircraft || !startPosition || isLaunching || invalidAirSpeed}
            className="w-full"
            size="lg"
          >
            {isLaunching ? (
              <>
                <Spinner className="" />
                {isXPlaneRunning ? t('launcher.changingFlight') : t('launcher.launching')}
              </>
            ) : isXPlaneRunning ? (
              t('launcher.changeFlight')
            ) : (
              t('launcher.launch')
            )}
          </Button>
          {!startPosition && (
            <p className="text-muted-foreground mt-1.5 text-center text-sm">
              {t('launcher.selectDeparture')}
            </p>
          )}
          {isXPlaneRunning && (
            <p className="text-muted-foreground mt-1.5 text-center text-sm">
              {t('launcher.xplaneRunning')}
            </p>
          )}
        </div>
      </div>

      <WeatherDialog
        open={weatherDialogOpen}
        onClose={() => setWeatherDialogOpen(false)}
        airportElevationFt={selectedAirportData?.elevation}
      />
      <WeightBalanceDialog open={weightDialogOpen} onClose={() => setWeightDialogOpen(false)} />
    </div>
  );
}
