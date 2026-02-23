import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Fuel,
  Globe,
  Loader2,
  Power,
  PowerOff,
  Radio,
  Sun,
} from 'lucide-react';
import tzLookup from 'tz-lookup';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { StartPosition } from '../types';
import { WEATHER_OPTIONS } from '../types';
import { SunArc } from './SunArc';

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
  const fuelPercentage = useLaunchStore((s) => s.fuelPercentage);
  const timeOfDay = useLaunchStore((s) => s.timeOfDay);
  const useRealWorldTime = useLaunchStore((s) => s.useRealWorldTime);
  const coldAndDark = useLaunchStore((s) => s.coldAndDark);
  const selectedWeather = useLaunchStore((s) => s.selectedWeather);
  const isLaunching = useLaunchStore((s) => s.isLaunching);
  const launchError = useLaunchStore((s) => s.launchError);

  // Zustand store actions
  const setFuelPercentage = useLaunchStore((s) => s.setFuelPercentage);
  const setTimeOfDay = useLaunchStore((s) => s.setTimeOfDay);
  const setUseRealWorldTime = useLaunchStore((s) => s.setUseRealWorldTime);
  const setColdAndDark = useLaunchStore((s) => s.setColdAndDark);
  const setSelectedWeather = useLaunchStore((s) => s.setSelectedWeather);

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

  const totalFuel = useMemo(() => {
    if (selectedAircraft) {
      return (selectedAircraft.maxFuel * fuelPercentage) / 100;
    }
    return 0;
  }, [selectedAircraft, fuelPercentage]);

  return (
    <div className="flex w-64 min-w-[240px] flex-col border-l border-border/50 bg-card lg:w-72">
      <div className="flex-shrink-0 px-4 py-3">
        <h3 className="xp-section-heading mb-0 border-0 pb-0">{t('launcher.config.summary')}</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 pb-4">
        {/* Time */}
        <div className="space-y-2.5">
          <Label className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t('launcher.config.timeOfDay')}
          </Label>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setUseRealWorldTime(true)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                useRealWorldTime
                  ? 'bg-primary/10 text-primary ring-2 ring-primary'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Radio className="h-5 w-5" />
              <span className="text-xs">{t('launcher.time.live')}</span>
            </button>
            <button
              type="button"
              onClick={() => setUseRealWorldTime(false)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                !useRealWorldTime
                  ? 'bg-primary/10 text-primary ring-2 ring-primary'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Clock className="h-5 w-5" />
              <span className="text-xs">{t('launcher.time.set')}</span>
            </button>
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
        </div>

        {/* Weather Presets */}
        <div className="space-y-2.5">
          <Label className="flex items-center gap-2 text-sm">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            {t('launcher.config.weather')}
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {WEATHER_OPTIONS.map((weather) => {
              const Icon = WEATHER_ICONS[weather] || Cloud;
              const isActive = selectedWeather === weather;
              return (
                <button
                  key={weather}
                  type="button"
                  onClick={() => setSelectedWeather(weather)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                      ? 'bg-primary/10 text-primary ring-2 ring-primary'
                      : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{t(`launcher.weather.${weather}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fuel */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Fuel className="h-4 w-4 text-muted-foreground" />
              {t('launcher.config.fuel')}
            </Label>
            <span className="font-mono text-sm">
              {fuelPercentage}%
              {selectedAircraft && selectedAircraft.maxFuel > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({formatWeight(totalFuel, weightUnit)})
                </span>
              )}
            </span>
          </div>
          <Slider
            value={[fuelPercentage]}
            onValueChange={(v) => setFuelPercentage(v[0])}
            min={0}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('launcher.fuelModal.empty')}</span>
            <span>{t('launcher.fuelModal.full')}</span>
          </div>
        </div>

        {/* Aircraft Start State */}
        <div className="space-y-2.5">
          <Label className="flex items-center gap-2 text-sm">
            <Power className="h-4 w-4 text-muted-foreground" />
            {t('launcher.config.startState')}
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setColdAndDark(false)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                !coldAndDark
                  ? 'bg-primary/10 text-primary ring-2 ring-primary'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Power className="h-5 w-5" />
              <span className="text-xs">{t('launcher.startState.ready')}</span>
            </button>
            <button
              type="button"
              onClick={() => setColdAndDark(true)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                coldAndDark
                  ? 'bg-primary/10 text-primary ring-2 ring-primary'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <PowerOff className="h-5 w-5" />
              <span className="text-xs">{t('launcher.startState.cold')}</span>
            </button>
          </div>
        </div>

        {/* Flight Summary */}
        <div className="space-y-1.5 rounded-lg bg-secondary p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.aircraft.title')}</span>
            <span className="text-right font-mono text-xs text-foreground">
              {selectedAircraft?.name || '—'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.config.livery')}</span>
            <span className="text-right font-mono text-xs text-foreground">{selectedLivery}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="xp-label shrink-0">{t('launcher.config.departure')}</span>
            <span className="text-right font-mono text-xs text-primary">
              {startPosition ? `${startPosition.airport} ${startPosition.name}` : '—'}
            </span>
          </div>
        </div>

        {launchError && (
          <Alert variant="destructive" className="p-2">
            <AlertDescription className="text-xs">{launchError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Launch button */}
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
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            {t('launcher.selectDeparture')}
          </p>
        )}
        {isXPlaneRunning && (
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            {t('launcher.xplaneRunning')}
          </p>
        )}
      </div>
    </div>
  );
}
