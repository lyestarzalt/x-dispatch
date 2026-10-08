/**
 * Time and weather as one card whose background is the sky at the chosen moment:
 * night, dawn, day or dusk from the sun's position at the airport, washed by the
 * weather preset. Colours are theme tokens blended in oklch so the card follows
 * the palette in both themes. The sun arc, the readout and the weather choices sit on it.
 */
import { useMemo } from 'react';
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
  Radio,
  Settings2,
  Sun,
} from 'lucide-react';
import * as SunCalc from 'suncalc';
import tzlookup from 'tz-lookup';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import { formatWind, skyCondition } from '@/lib/utils/metar';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { WEATHER_OPTIONS } from '../types';
import { SunArc, formatHours, getHoursInTimezone } from './SunArc';
import { LAUNCH_CHOICE } from './choiceStyle';

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
  // Fetched whatever is selected, so the Real button can say what the weather is right now.
  const { data: metar } = useVatsimMetarQuery(metarIcao);

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

  const metarLine = useMemo(() => {
    if (!metar) return null;
    const m = metar.parsed;
    const parts = [
      t(`launcher.weather.sky.${skyCondition(m)}`),
      formatWind(m.wind, { verbose: true }),
    ];
    if (m.temperature != null) parts.push(`${m.temperature} °C`);
    return { text: parts.join(' · '), category: metar.flightCategory };
  }, [metar, t]);

  return (
    <section className="space-y-2">
      {/* Header outside the card, like the other launcher sections */}
      <div className="flex items-center justify-between gap-2">
        <span className="xp-label flex min-w-0 items-center gap-2">
          <CloudSun className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('launcher.config.conditions')}</span>
        </span>
        <ToggleGroup
          type="single"
          variant="subtle"
          size="xs"
          value={useRealWorldTime ? 'live' : 'set'}
          onValueChange={(v) => {
            if (v) onModeChange(v === 'live');
          }}
          className="shrink-0 gap-1.5"
        >
          <ToggleGroupItem value="live">
            <Radio />
            <span>{t('launcher.time.live')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="set">
            <Clock />
            <span>{t('launcher.time.set')}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div
        className="border-border/50 relative overflow-hidden rounded-lg border"
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

        <div className="relative space-y-3 p-3">
          {/* Readout */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-foreground font-mono text-3xl font-semibold tabular-nums">
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

          {/* Weather in three tiers: live, presets, the full editor */}
          <ToggleGroup
            type="single"
            value={weatherValue === 'custom' ? '' : weatherValue}
            onValueChange={(v) => {
              if (v) onWeatherChange(v);
            }}
            className="grid grid-cols-3 items-stretch gap-1.5"
          >
            <ToggleGroupItem
              value="real"
              className={cn(
                'col-span-3 h-auto min-w-0 justify-start gap-3 px-3 py-2 text-left',
                LAUNCH_CHOICE
              )}
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {t('launcher.weather.realTitle')}
                </span>
                <span className={cn('text-muted-foreground block truncate text-xs')}>
                  {metarLine?.text ?? t('launcher.weather.realHint')}
                </span>
              </span>
              {metarLine?.category && (
                <Badge variant="outline" className="text-2xs shrink-0 font-mono">
                  {metarLine.category}
                </Badge>
              )}
            </ToggleGroupItem>
            {WEATHER_OPTIONS.filter((weather) => weather !== 'real').map((weather) => {
              const Icon = WEATHER_ICONS[weather] ?? Cloud;
              return (
                <ToggleGroupItem
                  key={weather}
                  value={weather}
                  className={cn('h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs', LAUNCH_CHOICE)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="w-full truncate text-center">
                    {t(`launcher.weather.${weather}`)}
                  </span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          {/* The full editor, named for what it does so it is found */}
          <button
            type="button"
            aria-pressed={weatherValue === 'custom'}
            onClick={() => onWeatherChange('custom')}
            className={cn(
              'flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
              LAUNCH_CHOICE
            )}
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {t('launcher.weatherModal.customTitle')}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {customSummary ?? t('launcher.weatherModal.customHint')}
              </span>
            </span>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </section>
  );
}
