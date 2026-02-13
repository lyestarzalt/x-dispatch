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
  Moon,
  Power,
  Sun,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { formatWeight } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Aircraft, StartPosition } from '../types';
import { WEATHER_OPTIONS } from '../types';
import { SunArc } from './SunArc';

interface FlightConfigProps {
  aircraft: Aircraft | null;
  startPosition: StartPosition | null;
  selectedLivery: string;
  timeOfDay: number;
  selectedWeather: string;
  fuelPercentage: number;
  useSystemTime: boolean;
  coldAndDark: boolean;
  isLoading: boolean;
  launchError: string | null;
  isXPlaneRunning: boolean;
  onTimeChange: (time: number) => void;
  onWeatherChange: (weather: string) => void;
  onFuelChange: (fuel: number) => void;
  onSystemTimeChange: (useSystem: boolean) => void;
  onColdAndDarkChange: (coldDark: boolean) => void;
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

export function FlightConfig({
  aircraft,
  startPosition,
  selectedLivery,
  timeOfDay,
  selectedWeather,
  fuelPercentage,
  useSystemTime,
  coldAndDark,
  isLoading,
  launchError,
  isXPlaneRunning,
  onTimeChange,
  onWeatherChange,
  onFuelChange,
  onSystemTimeChange,
  onColdAndDarkChange,
  onLaunch,
}: FlightConfigProps) {
  const { t } = useTranslation();
  const weightUnit = useSettingsStore((state) => state.map.units.weight);

  // Current time state - updates every minute when using system time
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    if (!useSystemTime) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [useSystemTime]);

  // Memoized time display values
  const { localTimeStr, utcTimeStr, isDay } = useMemo(() => {
    const hours = currentTime.getHours();
    return {
      localTimeStr: currentTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      utcTimeStr: currentTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }),
      isDay: hours >= 6 && hours < 18,
    };
  }, [currentTime]);

  // Calculate total fuel
  const totalFuel = useMemo(() => {
    if (aircraft) {
      return (aircraft.maxFuel * fuelPercentage) / 100;
    }
    return 0;
  }, [aircraft, fuelPercentage]);

  return (
    <div className="flex w-64 min-w-[240px] flex-col border-l border-border bg-card lg:w-72">
      {/* Section Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-2">
        <h3 className="xp-section-heading mb-0 border-0 pb-0">{t('launcher.config.summary')}</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {/* Time of Day */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('launcher.config.timeOfDay')}
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('launcher.config.systemTime')}
              </span>
              <Switch checked={useSystemTime} onCheckedChange={onSystemTimeChange} />
            </div>
          </div>
          {useSystemTime ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2">
              <div className="flex items-center gap-2">
                {isDay ? (
                  <Sun className="h-4 w-4 text-warning" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-mono text-lg font-semibold">{localTimeStr}</span>
                <span className="text-xs text-muted-foreground">local</span>
              </div>
              <span className="font-mono text-sm text-muted-foreground">{utcTimeStr}Z</span>
            </div>
          ) : startPosition ? (
            <SunArc
              timeOfDay={timeOfDay}
              latitude={startPosition.latitude}
              longitude={startPosition.longitude}
              onTimeChange={onTimeChange}
            />
          ) : (
            <>
              <Slider
                value={[timeOfDay]}
                onValueChange={(v) => onTimeChange(v[0])}
                min={0}
                max={24}
                step={0.5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </>
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
                  onClick={() => onWeatherChange(weather)}
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
              {aircraft && aircraft.maxFuel > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({formatWeight(totalFuel, weightUnit)})
                </span>
              )}
            </span>
          </div>
          <Slider
            value={[fuelPercentage]}
            onValueChange={(v) => onFuelChange(v[0])}
            min={0}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('launcher.fuelModal.empty')}</span>
            <span>{t('launcher.fuelModal.full')}</span>
          </div>
        </div>

        {/* Cold & Dark Toggle */}
        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
          <Label className="flex items-center gap-2 text-sm">
            <Power className="h-4 w-4 text-muted-foreground" />
            {t('launcher.config.coldAndDark')}
          </Label>
          <Switch checked={coldAndDark} onCheckedChange={onColdAndDarkChange} />
        </div>

        {/* Flight Summary */}
        <div className="space-y-2 rounded-lg bg-secondary p-3">
          <div className="flex items-center justify-between">
            <span className="xp-label">{t('launcher.aircraft.title')}</span>
            <span
              className="max-w-[130px] truncate font-mono text-xs text-foreground"
              title={aircraft?.name || undefined}
            >
              {aircraft?.name || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="xp-label">{t('launcher.config.livery')}</span>
            <span
              className="max-w-[130px] truncate font-mono text-xs text-foreground"
              title={selectedLivery}
            >
              {selectedLivery}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="xp-label">{t('launcher.config.departure')}</span>
            <span
              className="max-w-[130px] truncate font-mono text-xs text-primary"
              title={startPosition ? `${startPosition.airport} ${startPosition.name}` : undefined}
            >
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
      <div className="flex-shrink-0 border-t p-3">
        <Button
          onClick={onLaunch}
          disabled={!aircraft || !startPosition || isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
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
