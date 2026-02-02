import { useMemo } from 'react';
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import SunCalc from 'suncalc';
import tzlookup from 'tz-lookup';
import { Slider } from '@/components/ui/slider';
import { formatZulu } from '@/lib/format';

interface SunArcProps {
  timeOfDay: number;
  latitude: number;
  longitude: number;
  onTimeChange: (time: number) => void;
}

function formatTimeInZone(hours: number, timezone: string): string {
  const date = new Date();
  date.setUTCHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: false,
  });
}

function getHoursInTimezone(date: Date, timezone: string): number {
  const str = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: false,
  });
  const [h, m] = str.split(':').map(Number);
  return h + m / 60;
}

export function SunArc({ timeOfDay, latitude, longitude, onTimeChange }: SunArcProps) {
  const { timezone, sunriseHours, sunsetHours, localTime, zuluTime } = useMemo(() => {
    const tz = tzlookup(latitude, longitude) || 'UTC';
    const today = new Date();
    const times = SunCalc.getTimes(today, latitude, longitude);

    return {
      timezone: tz,
      sunriseHours: getHoursInTimezone(times.sunrise, tz),
      sunsetHours: getHoursInTimezone(times.sunset, tz),
      localTime: formatTimeInZone(timeOfDay, tz),
      zuluTime: formatZulu(timeOfDay),
    };
  }, [latitude, longitude, timeOfDay]);

  const isDay = timeOfDay >= sunriseHours && timeOfDay <= sunsetHours;

  return (
    <div className="space-y-3">
      {/* Time display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDay ? (
            <Sun className="h-4 w-4 text-yellow-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-400" />
          )}
          <span className="font-mono text-lg font-semibold">{localTime}</span>
          <span className="text-xs text-muted-foreground">local</span>
        </div>
        <div className="text-right">
          <span className="font-mono text-sm text-muted-foreground">{zuluTime}</span>
        </div>
      </div>

      {/* Slider */}
      <Slider
        value={[timeOfDay]}
        onValueChange={(v) => onTimeChange(v[0])}
        min={0}
        max={24}
        step={0.25}
      />

      {/* Sunrise/Sunset times */}
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1 text-orange-400">
          <Sunrise className="h-3 w-3" />
          <span>{formatTimeInZone(sunriseHours, timezone)}</span>
        </div>
        <span className="text-muted-foreground">
          {timezone.split('/').pop()?.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-1 text-orange-400">
          <Sunset className="h-3 w-3" />
          <span>{formatTimeInZone(sunsetHours, timezone)}</span>
        </div>
      </div>
    </div>
  );
}
