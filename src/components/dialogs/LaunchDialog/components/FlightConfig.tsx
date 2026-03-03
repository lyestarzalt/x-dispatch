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
  Loader2,
  Power,
  PowerOff,
  Radio,
  Settings2,
  Sun,
  Weight,
} from 'lucide-react';
import tzLookup from 'tz-lookup';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
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

export function FlightConfig({ startPosition, isXPlaneRunning, onLaunch }: FlightConfigProps) {
  const { t } = useTranslation();
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

      const airportHours = parseInt(airportTimeStr.split(':')[0], 10);
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

  return (
    <div className="flex w-64 min-w-[240px] flex-col border-l border-border/50 bg-card lg:w-72">
      <div className="flex-shrink-0 px-4 py-3">
        <h3 className="xp-section-heading mb-0 border-0 pb-0">{t('launcher.config.summary')}</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 pb-4">
        {/* ── Time of Day ────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t('launcher.config.timeOfDay')}
          </Label>

          <div className="grid grid-cols-2 gap-1.5">
            <ToggleButton
              active={useRealWorldTime}
              onClick={() => setUseRealWorldTime(true)}
              icon={Radio}
              label={t('launcher.time.live')}
            />
            <ToggleButton
              active={!useRealWorldTime}
              onClick={() => setUseRealWorldTime(false)}
              icon={Clock}
              label={t('launcher.time.set')}
            />
          </div>

          {useRealWorldTime && airportTimeInfo && (
            <div className="text-center font-mono text-lg text-foreground">
              {airportTimeInfo.airportTimeStr}
              <span className="ml-2 text-xs text-muted-foreground">{airportTimeInfo.offset}</span>
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
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cloud className="h-4 w-4" />
            {t('launcher.config.weather')}
          </Label>

          <div className="grid grid-cols-4 gap-1">
            {WEATHER_OPTIONS.map((weather) => {
              const Icon = WEATHER_ICONS[weather] || Cloud;
              const isActive =
                (weather === 'real' && weatherConfig.mode === 'real') ||
                (weather !== 'real' &&
                  weatherConfig.mode !== 'real' &&
                  weatherConfig.preset === weather &&
                  weatherConfig.mode === 'preset');
              return (
                <button
                  key={weather}
                  type="button"
                  onClick={() => setWeatherPreset(weather)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md px-1.5 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                      ? 'bg-primary/10 text-primary ring-1 ring-primary'
                      : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(`launcher.weather.${weather}`)}</span>
                </button>
              );
            })}
          </div>

          {/* Customize / summary card */}
          <button
            type="button"
            onClick={() => setWeatherDialogOpen(true)}
            className="group flex w-full items-center justify-between rounded-md border border-border/50 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="min-w-0">
              <span
                className={cn(
                  'text-sm font-medium',
                  weatherConfig.mode === 'custom' ? 'text-primary' : 'text-foreground'
                )}
              >
                {weatherConfig.mode === 'custom'
                  ? 'Customized'
                  : weatherConfig.mode === 'real'
                    ? t('launcher.weather.real')
                    : t(`launcher.weather.${weatherConfig.preset}`)}
              </span>
              {weatherConfig.mode !== 'real' && (
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                  {getWeatherSummary(weatherConfig)}
                </span>
              )}
            </div>
            <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:rotate-45" />
          </button>
        </section>

        {/* ── Weight & Fuel ──────────────────────────────── */}
        <section className="space-y-2">
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Weight className="h-4 w-4" />
            Weight &amp; Fuel
          </Label>
          {selectedAircraft && (
            <Button
              variant="outline"
              onClick={() => setWeightDialogOpen(true)}
              className={cn(
                'group h-auto w-full justify-between px-2.5 py-2',
                isOverweight && 'border-destructive/40 hover:border-destructive/60'
              )}
            >
              <div className="min-w-0 text-left">
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      'font-mono text-sm font-medium',
                      isOverweight ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {formatWeight(totalWeight, weightUnit)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    / {formatWeight(selectedAircraft.maxWeight, weightUnit)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    {formatWeight(totalFuelLbs, weightUnit)}
                  </span>
                  {totalPayloadLbs > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                      {formatWeight(totalPayloadLbs, weightUnit)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Button>
          )}
        </section>

        {/* ── Start State ────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Power className="h-4 w-4" />
            {t('launcher.config.startState')}
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <ToggleButton
              active={!coldAndDark}
              onClick={() => setColdAndDark(false)}
              icon={Power}
              label={t('launcher.startState.ready')}
            />
            <ToggleButton
              active={coldAndDark}
              onClick={() => setColdAndDark(true)}
              icon={PowerOff}
              label={t('launcher.startState.cold')}
            />
          </div>
        </section>

        {/* ── Flight Summary ─────────────────────────────── */}
        <div className="space-y-1.5 rounded-lg bg-secondary/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.aircraft.title')}</span>
            <span className="text-right font-mono text-sm text-foreground">
              {selectedAircraft?.name || '—'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.config.livery')}</span>
            <span className="text-right font-mono text-sm text-foreground">{selectedLivery}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.config.departure')}</span>
            <span className="text-right font-mono text-sm text-primary">
              {startPosition ? `${startPosition.airport} ${startPosition.name}` : '—'}
            </span>
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
          onClick={onLaunch}
          disabled={!selectedAircraft || !startPosition || isLaunching}
          className="w-full"
          size="lg"
        >
          {isLaunching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isXPlaneRunning ? t('launcher.changingFlight') : t('launcher.launching')}
            </>
          ) : isXPlaneRunning ? (
            t('launcher.changeFlight')
          ) : (
            t('launcher.launch')
          )}
        </Button>
        {!startPosition && (
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            {t('launcher.selectDeparture')}
          </p>
        )}
        {isXPlaneRunning && (
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            {t('launcher.xplaneRunning')}
          </p>
        )}
      </div>

      <WeatherDialog open={weatherDialogOpen} onClose={() => setWeatherDialogOpen(false)} />
      <WeightBalanceDialog open={weightDialogOpen} onClose={() => setWeightDialogOpen(false)} />
    </div>
  );
}

// ─── Shared toggle button for Time & Start State ─────────────────────────────

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-primary'
          : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
