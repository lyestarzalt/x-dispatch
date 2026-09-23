import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Globe,
  Power,
  PowerOff,
  Radio,
  Settings2,
  Sun,
  Weight,
} from 'lucide-react';
import tzLookup from 'tz-lookup';
import { AirStartSpeedInput } from '@/components/AirStartSpeedInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { airSpeedFromMs, isValidAirStartSpeed } from '@/lib/utils/airStartSpeed';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '../types';
import { WEATHER_OPTIONS } from '../types';
import { getWeatherSummary } from '../weatherTypes';
import { SunArc } from './SunArc';
import { WeatherDialog } from './WeatherDialog';
import { WeightBalanceDialog } from './WeightBalanceDialog';

interface FlightConfigProps {
  startPosition: StartPosition | null;
  isXPlaneRunning: boolean;
  onLaunch: () => void;
  aircraftList: Aircraft[];
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  real: Globe,
  clear: Sun,
  cloudy: CloudSun,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: CloudSnow,
  foggy: CloudFog,
};

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
  const isAirStart = startPosition?.type === 'custom' && startPosition.customStartMode === 'air';
  const invalidAirSpeed = isAirStart && !isValidAirStartSpeed(startPosition.airSpeedMs);
  const weightUnit = useSettingsStore((state) => state.map.units.weight);

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

      return { airportTimeStr, airportDateStr, utcTimeStr, offset, isDay };
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

  const weightPct = selectedAircraft?.maxWeight
    ? Math.min(100, (totalWeight / selectedAircraft.maxWeight) * 100)
    : 0;
  const isOverweight = selectedAircraft ? totalWeight > selectedAircraft.maxWeight : false;

  // Derive weather toggle value
  const weatherValue =
    weatherConfig.mode === 'real'
      ? 'real'
      : weatherConfig.mode === 'preset'
        ? weatherConfig.preset
        : 'custom';

  return (
    <div className="border-border/50 bg-card flex w-72 min-w-[260px] shrink-0 flex-col border-l lg:w-80">
      <div className="flex-shrink-0 px-4 py-3">
        <h3 className="xp-section-heading mb-0 border-0 pb-0">{t('launcher.config.summary')}</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 pb-4">
        {/* ── Time of Day ────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            {t('launcher.config.timeOfDay')}
          </Label>

          <ToggleGroup
            type="single"
            variant="subtle"
            value={useRealWorldTime ? 'live' : 'set'}
            onValueChange={(v) => {
              if (v) setUseRealWorldTime(v === 'live');
            }}
            className="grid grid-cols-2 gap-1.5"
          >
            <ToggleGroupItem value="live" className="h-auto gap-1.5 px-2 py-2 text-sm">
              <Radio className="h-4 w-4" />
              <span>{t('launcher.time.live')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="set" className="h-auto gap-1.5 px-2 py-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>{t('launcher.time.set')}</span>
            </ToggleGroupItem>
          </ToggleGroup>

          {useRealWorldTime && airportTimeInfo && (
            <div className="text-foreground text-center font-mono text-lg">
              {airportTimeInfo.airportTimeStr}
              <span className="text-muted-foreground ml-2 text-xs">{airportTimeInfo.offset}</span>
            </div>
          )}

          {!useRealWorldTime && airportCoords && (
            <SunArc
              timeOfDay={timeOfDay}
              latitude={airportCoords.latitude}
              longitude={airportCoords.longitude}
              onTimeChange={setTimeOfDay}
            />
          )}
        </section>

        {/* ── Weather ────────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2 text-sm">
            <Cloud className="h-4 w-4" />
            {t('launcher.config.weather')}
          </Label>

          <ToggleGroup
            type="single"
            variant="subtle"
            value={weatherValue}
            onValueChange={(v) => {
              if (!v) return;
              if (v === 'custom') {
                setWeatherDialogOpen(true);
              } else {
                setWeatherPreset(v);
              }
            }}
            className="grid grid-cols-4 gap-1.5"
          >
            {WEATHER_OPTIONS.map((weather) => {
              const Icon = WEATHER_ICONS[weather] || Cloud;
              return (
                <ToggleGroupItem
                  key={weather}
                  value={weather}
                  className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="w-full truncate text-center">
                    {t(`launcher.weather.${weather}`)}
                  </span>
                </ToggleGroupItem>
              );
            })}
            <ToggleGroupItem
              value="custom"
              onClick={() => setWeatherDialogOpen(true)}
              className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs"
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="w-full truncate text-center">
                {t('launcher.weatherModal.custom')}
              </span>
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Summary line when customized */}
          {weatherConfig.mode === 'custom' && (
            <span className="text-muted-foreground block font-mono text-xs">
              {getWeatherSummary(weatherConfig)}
            </span>
          )}
        </section>

        {/* ── Weight & Fuel ──────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground flex items-center gap-2 text-sm">
              <Weight className="h-4 w-4" />
              {t('launcher.weightFuelLabel')}
            </Label>
            {selectedAircraft && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWeightDialogOpen(true)}
                className="h-6 w-6"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {selectedAircraft && (
            <>
              {/* Weight bar */}
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isOverweight ? 'bg-destructive' : 'bg-primary'
                  )}
                  style={{ width: `${weightPct}%` }}
                />
              </div>
              {/* Numbers */}
              <div className="flex items-baseline justify-between">
                <span
                  className={cn(
                    'font-mono text-sm font-medium',
                    isOverweight ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {formatWeight(totalWeight, weightUnit)}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  / {formatWeight(selectedAircraft.maxWeight, weightUnit)}
                </span>
              </div>
              {/* Fuel + Payload breakdown */}
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                  {formatWeight(totalFuelLbs, weightUnit)}
                </span>
                {totalPayloadLbs > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="bg-success inline-block h-1.5 w-1.5 rounded-full" />
                    {formatWeight(totalPayloadLbs, weightUnit)}
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── Start State ────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2 text-sm">
            <Power className="h-4 w-4" />
            {t('launcher.config.startState')}
          </Label>
          <ToggleGroup
            type="single"
            variant="subtle"
            value={coldAndDark ? 'cold' : 'ready'}
            onValueChange={(v) => {
              if (v) setColdAndDark(v === 'cold');
            }}
            className="grid grid-cols-2 gap-1.5"
          >
            <ToggleGroupItem value="ready" className="h-auto gap-1.5 px-2 py-2 text-sm">
              <Power className="h-4 w-4" />
              <span>{t('launcher.startState.ready')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="cold" className="h-auto gap-1.5 px-2 py-2 text-sm">
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
        <div className="bg-secondary/50 space-y-1.5 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.aircraft.title')}</span>
            <span className="text-foreground text-right font-mono text-sm">
              {selectedAircraft?.name || '—'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.config.livery')}</span>
            <span className="text-foreground text-right font-mono text-sm">{selectedLivery}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.config.departure')}</span>
            <div className="text-right">
              <span className="text-primary font-mono text-sm">
                {startPosition ? `${startPosition.airport} ${startPosition.name}` : '—'}
              </span>
              {startPosition?.approachDistanceNm != null && (
                <div className="text-muted-foreground text-xs">
                  {t('airportInfo.runway.approachNm', {
                    distance: startPosition.approachDistanceNm,
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
                  {t('toolbar.pinModes.air')}{' '}
                  {Math.round((startPosition.airAltitudeM ?? 914.4) / 0.3048).toLocaleString()} ft
                  {isValidAirStartSpeed(startPosition.airSpeedMs) &&
                    ` · ${Math.round(airSpeedFromMs(startPosition.airSpeedMs, startPosition.airSpeedUnit ?? 'kt'))} ${t(`units.${startPosition.airSpeedUnit ?? 'kt'}`)}`}
                </div>
              )}
              {(startPosition?.customStartMode === 'carrier' ||
                startPosition?.customStartMode === 'frigate') && (
                <div className="text-muted-foreground text-xs">
                  {t(`toolbar.pinModes.${startPosition.customStartMode}`)}
                  {startPosition.boatPosition
                    ? ` · ${t(`toolbar.pinModes.cat_${startPosition.boatPosition}`)}`
                    : startPosition.boatApproachNm
                      ? ` · ${startPosition.boatApproachNm} nm`
                      : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {launchError && (
          <Alert variant="destructive" className="p-2">
            <AlertDescription className="text-sm">{launchError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Launch button — pinned to bottom */}
      <div className="flex-shrink-0 p-3">
        <Button
          data-testid="confirm-launch"
          onClick={onLaunch}
          disabled={!selectedAircraft || !startPosition || isLaunching || invalidAirSpeed}
          className="w-full"
          size="lg"
        >
          {isLaunching ? (
            <>
              <Spinner className="mr-2" />
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

      <WeatherDialog
        open={weatherDialogOpen}
        onClose={() => setWeatherDialogOpen(false)}
        airportElevationFt={selectedAirportData?.elevation}
      />
      <WeightBalanceDialog open={weightDialogOpen} onClose={() => setWeightDialogOpen(false)} />
    </div>
  );
}
