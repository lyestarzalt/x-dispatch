/**
 * Time and weather as one card whose background is the sky at the chosen moment:
 * night, dawn, day or dusk from the sun's position at the airport, washed by the
 * weather preset. Colours are theme tokens blended in oklch so the card follows
 * the palette in both themes. The sun arc, the readout and the weather choices sit on it.
 */
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
  Globe,
  Radio,
  Settings2,
  Sun,
} from 'lucide-react';
import * as SunCalc from 'suncalc';
import tzlookup from 'tz-lookup';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { WEATHER_OPTIONS } from '../types';
import { SunArc, formatHours, getHoursInTimezone } from './SunArc';

const WEATHER_ICONS: Record<string, typeof Sun> = {
  real: Globe,
  clear: Sun,
  cloudy: CloudSun,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: CloudSnow,
  foggy: CloudFog,
  custom: Settings2,
};

const WEATHER_CHOICES = [...WEATHER_OPTIONS, 'custom'];

/** Share of the muted token washed over the sky per preset; clear and real show it as is. */
const WEATHER_WASH: Record<string, number> = {
  cloudy: 30,
  rainy: 45,
  stormy: 60,
  snowy: 35,
  foggy: 45,
};

/** Theme tokens blended in oklch. */
function mix(token: string, percent: number, base = 'var(--card)'): string {
  return `color-mix(in oklch, var(--${token}) ${Math.round(percent)}%, ${base})`;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Daylight 0..1 and golden hour 0..1 for an hour of the day given sunrise and sunset hours. */
export function daylight(hour: number, sunrise: number, sunset: number) {
  // Daylight ramps over an hour either side of sunrise and sunset.
  const day =
    smoothstep(sunrise - 1, sunrise + 1, hour) * (1 - smoothstep(sunset - 1, sunset + 1, hour));
  // Golden light peaks at sunrise and sunset and fades within ninety minutes.
  const golden = Math.max(0, 1 - Math.abs(hour - sunrise) / 1.5, 1 - Math.abs(hour - sunset) / 1.5);
  return { day, golden };
}

/** Sky gradient stops: primary for daylight, warning for golden hour, the card colour at night. */
export function skyColors(hour: number, sunrise: number, sunset: number): [string, string] {
  const { day, golden } = daylight(hour, sunrise, sunset);
  const top = mix('warning', golden * 12, mix('primary', day * 28));
  const bottom = mix('warning', golden * 30, mix('primary', day * 45));
  return [top, bottom];
}

export interface LiveClock {
  hours: number;
  timeStr: string;
  dateStr: string;
  utcStr: string;
  offset: string;
}

interface ConditionsCardProps {
  coords: { latitude: number; longitude: number } | null;
  timeOfDay: number;
  live: LiveClock | null;
  useRealWorldTime: boolean;
  onModeChange: (live: boolean) => void;
  onTimeChange: (hours: number) => void;
  weatherValue: string;
  onWeatherChange: (value: string) => void;
  customSummary: string | null;
  metarIcao: string | null;
}

export function ConditionsCard({
  coords,
  timeOfDay,
  live,
  useRealWorldTime,
  onModeChange,
  onTimeChange,
  weatherValue,
  onWeatherChange,
  customSummary,
  metarIcao,
}: ConditionsCardProps) {
  const { t } = useTranslation();
  const { data: metar } = useVatsimMetarQuery(weatherValue === 'real' ? metarIcao : null);

  const sun = useMemo(() => {
    if (!coords) return { sunrise: 6, sunset: 18, dateStr: '' };
    const timezone = tzlookup(coords.latitude, coords.longitude) || 'UTC';
    const today = new Date();
    const times = SunCalc.getTimes(today, coords.latitude, coords.longitude);
    const dateStr = today.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: timezone,
    });
    return {
      sunrise: times.sunrise ? getHoursInTimezone(times.sunrise, timezone) : 0,
      sunset: times.sunset ? getHoursInTimezone(times.sunset, timezone) : 24,
      dateStr,
    };
  }, [coords]);

  const isLive = useRealWorldTime && live !== null;
  const hour = isLive ? live.hours : timeOfDay;
  const [top, bottom] = skyColors(hour, sun.sunrise, sun.sunset);
  const nightShade = 1 - daylight(hour, sun.sunrise, sun.sunset).day;
  const wash = WEATHER_WASH[weatherValue];
  const isDay = hour >= sun.sunrise && hour <= sun.sunset;
  const untilChange = isDay
    ? sun.sunset - hour
    : hour > sun.sunset
      ? 24 - hour + sun.sunrise
      : sun.sunrise - hour;
  const untilH = Math.floor(untilChange);
  const untilM = Math.round((untilChange % 1) * 60);
  const Watermark = WEATHER_ICONS[weatherValue] ?? Cloud;

  const metarLine = useMemo(() => {
    if (!metar) return null;
    const m = metar.parsed;
    const parts: string[] = [];
    if (m.wind) {
      const dir = m.wind.degrees != null ? String(m.wind.degrees).padStart(3, '0') : 'VRB';
      const gust = m.wind.gust ? `G${m.wind.gust}` : '';
      parts.push(`${dir}°/${m.wind.speed ?? 0}${gust} ${m.wind.unit?.toLowerCase() ?? 'kt'}`);
    }
    if (m.cavok) parts.push('CAVOK');
    else if (m.visibility) parts.push(`${m.visibility.value} ${m.visibility.unit}`);
    if (m.temperature != null) parts.push(`${m.temperature}°C`);
    if (m.altimeter) parts.push(`${m.altimeter.unit === 'hPa' ? 'Q' : 'A'}${m.altimeter.value}`);
    return { text: parts.join(' · '), category: metar.flightCategory };
  }, [metar]);

  return (
    <div
      className="border-border/50 relative overflow-hidden rounded-xl border shadow-lg"
      style={{ background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` }}
    >
      {/* Night sinks towards the background token; weather washes towards muted. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: mix('background', nightShade * 55, 'transparent') }}
      />
      {wash && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: mix('muted', wash, 'transparent') }}
        />
      )}
      <Watermark
        className="text-foreground/10 pointer-events-none absolute -top-4 -right-4 h-28 w-28"
        strokeWidth={1}
      />

      <div className="relative space-y-3 p-3">
        {/* Mode */}
        <div className="flex items-center justify-between">
          <span className="xp-label">{t('launcher.config.conditions')}</span>
          <ToggleGroup
            type="single"
            variant="subtle"
            size="sm"
            value={useRealWorldTime ? 'live' : 'set'}
            onValueChange={(v) => {
              if (v) onModeChange(v === 'live');
            }}
            className="gap-1.5"
          >
            <ToggleGroupItem value="live" className="h-7 gap-1 px-2.5 text-xs">
              <Radio className="h-3.5 w-3.5" />
              <span>{t('launcher.time.live')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="set" className="h-7 gap-1 px-2.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              <span>{t('launcher.time.set')}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Readout */}
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-foreground font-mono text-4xl font-semibold tabular-nums">
                {isLive ? live.timeStr : formatHours(timeOfDay)}
              </span>
              <span className="text-muted-foreground text-xs">
                {isLive ? live.offset : t('sunArc.local')}
              </span>
            </div>
            <div className="text-muted-foreground text-xs">
              {isLive ? live.dateStr : sun.dateStr}
              {isLive && <span className="ml-2 font-mono">{live.utcStr}Z</span>}
            </div>
          </div>
          {coords && (
            <span className="text-muted-foreground text-right text-xs">
              {isDay
                ? t('launcher.conditions.untilSunset', { h: untilH, m: untilM })
                : t('launcher.conditions.untilSunrise', { h: untilH, m: untilM })}
            </span>
          )}
        </div>

        {/* Arc and slider, only when the time is set by hand */}
        {!useRealWorldTime && coords && (
          <SunArc
            bare
            timeOfDay={timeOfDay}
            latitude={coords.latitude}
            longitude={coords.longitude}
            onTimeChange={onTimeChange}
          />
        )}

        {/* Weather */}
        <ToggleGroup
          type="single"
          variant="subtle"
          value={weatherValue}
          onValueChange={(v) => {
            if (v) onWeatherChange(v);
          }}
          className="grid grid-cols-4 gap-1.5"
        >
          {WEATHER_CHOICES.map((weather) => {
            const Icon = WEATHER_ICONS[weather] ?? Cloud;
            return (
              <ToggleGroupItem
                key={weather}
                value={weather}
                onClick={weather === 'custom' ? () => onWeatherChange('custom') : undefined}
                className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-center">
                  {weather === 'custom'
                    ? t('launcher.weatherModal.custom')
                    : t(`launcher.weather.${weather}`)}
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        {metarLine && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground truncate font-mono text-xs">
              {metarLine.text}
            </span>
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              {metarLine.category}
            </Badge>
          </div>
        )}
        {customSummary && (
          <span className="text-muted-foreground block font-mono text-xs">{customSummary}</span>
        )}
      </div>
    </div>
  );
}
