import { useMemo } from 'react';
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
import { cn } from '@/lib/utils';
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
  onTimeChange: (time: number) => void;
  onWeatherChange: (weather: string) => void;
  onFuelChange: (fuel: number) => void;
  onSystemTimeChange: (useSystem: boolean) => void;
  onColdAndDarkChange: (coldDark: boolean) => void;
  onLaunch: () => void;
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
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
  onTimeChange,
  onWeatherChange,
  onFuelChange,
  onSystemTimeChange,
  onColdAndDarkChange,
  onLaunch,
}: FlightConfigProps) {
  const { t } = useTranslation();

  // Calculate total fuel
  const totalFuel = useMemo(() => {
    if (aircraft) {
      return (aircraft.maxFuel * fuelPercentage) / 100;
    }
    return 0;
  }, [aircraft, fuelPercentage]);

  return (
    <div className="flex w-72 flex-col border-l bg-card">
      <div className="flex-1 space-y-5 overflow-auto p-4">
        {/* Time of Day */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
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
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                {new Date().getHours() >= 6 && new Date().getHours() < 18 ? (
                  <Sun className="h-4 w-4 text-warning" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-mono text-lg font-semibold">
                  {new Date().toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
                <span className="text-xs text-muted-foreground">local</span>
              </div>
              <span className="font-mono text-sm text-muted-foreground">
                {new Date().toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: 'UTC',
                })}
                Z
              </span>
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
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            {t('launcher.config.weather')}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {WEATHER_OPTIONS.map((weather) => {
              const Icon = WEATHER_ICONS[weather] || Cloud;
              const isActive = selectedWeather === weather;
              return (
                <Button
                  key={weather}
                  variant="outline"
                  onClick={() => onWeatherChange(weather)}
                  className={cn(
                    'h-auto flex-col gap-1 p-2',
                    isActive && 'border-primary bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{t(`launcher.weather.${weather}`)}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Fuel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-muted-foreground" />
              {t('launcher.config.fuel')}
            </Label>
            <span className="text-sm font-medium">
              {fuelPercentage}%
              {aircraft && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({totalFuel.toFixed(0)} kg)
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

        {/* Cold & Dark */}
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            {t('launcher.config.coldAndDark')}
          </Label>
          <Switch checked={coldAndDark} onCheckedChange={onColdAndDarkChange} />
        </div>

        {/* Summary */}
        <div className="space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('launcher.aircraft.title')}</span>
            <span className="ml-2 max-w-[140px] truncate font-medium">{aircraft?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('launcher.config.livery')}</span>
            <span className="ml-2 max-w-[140px] truncate">{selectedLivery}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('launcher.config.departure')}</span>
            <span className="ml-2 max-w-[140px] truncate">
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
              {t('launcher.launching')}
            </>
          ) : (
            t('launcher.launch')
          )}
        </Button>
        {!startPosition && (
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            {t('launcher.selectDeparture')}
          </p>
        )}
      </div>
    </div>
  );
}
