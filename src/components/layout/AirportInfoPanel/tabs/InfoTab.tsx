import { useMemo, useState } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatFrequency } from '@/lib/utils/format';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAirportProcedures, useNavDataQuery } from '@/queries';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { getATISForAirport, parseATISRunways, useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import type { Frequency, Runway } from '@/types/apt';
import { FrequencyType, SurfaceType } from '@/types/apt';

const SURFACE_SHORT: Partial<Record<SurfaceType, string>> = {
  [SurfaceType.ASPHALT]: 'ASPH',
  [SurfaceType.CONCRETE]: 'CONC',
  [SurfaceType.TURF_OR_GRASS]: 'GRASS',
  [SurfaceType.DIRT]: 'DIRT',
  [SurfaceType.GRAVEL]: 'GRVL',
  [SurfaceType.WATER_RUNWAY]: 'WATER',
  [SurfaceType.SNOW_OR_ICE]: 'SNOW',
};

// Priority order for displaying frequencies
const FREQ_PRIORITY: FrequencyType[] = [
  FrequencyType.TOWER,
  FrequencyType.GROUND,
  FrequencyType.APPROACH,
  FrequencyType.DELIVERY,
  FrequencyType.CTAF,
  FrequencyType.AWOS,
];

const FREQ_SHORT: Partial<Record<FrequencyType, string>> = {
  [FrequencyType.TOWER]: 'TWR',
  [FrequencyType.GROUND]: 'GND',
  [FrequencyType.APPROACH]: 'APP',
  [FrequencyType.DELIVERY]: 'DEL',
  [FrequencyType.CTAF]: 'CTAF',
  [FrequencyType.AWOS]: 'ATIS',
  [FrequencyType.UNICOM]: 'UNIC',
  [FrequencyType.CENTER]: 'CTR',
};

export default function InfoTab() {
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: navData } = useNavDataQuery(
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null,
    50
  );
  const { data: procedures } = useAirportProcedures(icao);

  const metar = vatsimMetarData?.decoded ?? null;
  const atis = useMemo(() => getATISForAirport(vatsimData, icao ?? ''), [vatsimData, icao]);
  const primaryAtis = atis[0];
  const atisRunways = primaryAtis ? parseATISRunways(primaryAtis) : [];

  const [showMetar, setShowMetar] = useState(false);

  // Find longest runway
  const longestRunway = useMemo(() => {
    if (!airport?.runways.length) return null;
    return airport.runways.reduce<Runway | null>((longest, rwy) => {
      const length = runwayLengthFeet(rwy.ends[0], rwy.ends[1]);
      if (!longest) return rwy;
      const longestLength = runwayLengthFeet(longest.ends[0], longest.ends[1]);
      return length > longestLength ? rwy : longest;
    }, null);
  }, [airport?.runways]);

  const longestRunwayInfo = useMemo(() => {
    if (!longestRunway) return null;
    const e1 = longestRunway.ends[0];
    const e2 = longestRunway.ends[1];
    return {
      name: `${e1.name}/${e2.name}`,
      length: Math.round(runwayLengthFeet(e1, e2)),
      width: Math.round(metersToFeet(longestRunway.width)),
      surface: SURFACE_SHORT[longestRunway.surface_type] || '?',
      hasLighting: longestRunway.edge_lights || longestRunway.centerline_lights,
    };
  }, [longestRunway]);

  // Get top frequencies (max 4)
  const topFrequencies = useMemo(() => {
    if (!airport?.frequencies) return [];
    const freqMap = new Map<FrequencyType, Frequency>();
    for (const freq of airport.frequencies) {
      if (!freqMap.has(freq.type)) {
        freqMap.set(freq.type, freq);
      }
    }
    return FREQ_PRIORITY.filter((type) => freqMap.has(type))
      .slice(0, 4)
      .map((type) => freqMap.get(type)!);
  }, [airport?.frequencies]);

  // Counts
  const ilsCount = navData?.ils.length ?? 0;
  const sidCount = procedures?.sids.length ?? 0;
  const starCount = procedures?.stars.length ?? 0;
  const approachCount = procedures?.approaches.length ?? 0;

  const handleCopyFreq = (freq: number) => {
    navigator.clipboard.writeText(formatFrequency(freq));
  };

  if (!airport) return null;

  return (
    <div className="space-y-3">
      {/* ATIS - if VATSIM active */}
      {primaryAtis && (
        <div className="flex items-center gap-2 rounded bg-primary/5 px-2.5 py-1.5">
          <Badge variant="secondary" className="font-mono text-sm font-bold">
            {primaryAtis.atis_code || '?'}
          </Badge>
          <span className="text-xs text-muted-foreground">ATIS</span>
          {atisRunways.length > 0 && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span className="font-mono text-xs text-foreground">
                RWY {atisRunways.join(', ')}
              </span>
            </>
          )}
        </div>
      )}

      {/* Runway - Compact single line */}
      {longestRunwayInfo && (
        <div className="rounded border border-border/40 bg-muted/10 px-3 py-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-base font-semibold text-foreground">
                {longestRunwayInfo.name}
              </span>
              <span className="text-[10px] text-muted-foreground">LONGEST</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {longestRunwayInfo.length.toLocaleString()}'×{longestRunwayInfo.width}'
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{longestRunwayInfo.surface}</span>
            {longestRunwayInfo.hasLighting && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span>LGT</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Weather - Ultra compact */}
      {metar ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-1 font-mono text-xs">
            <span className="text-foreground">{formatWind(metar.wind)}</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-foreground">{formatVisibility(metar.visibility)}</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-foreground">{formatCeiling(metar.clouds)}</span>
          </div>
          <div className="flex items-center justify-between px-1 font-mono text-[10px] text-muted-foreground">
            <span>QNH {formatAltimeter(metar.altimeter, metar.altimeterUnit)}</span>
            <span>
              {metar.temperature ?? '—'}°/{metar.dewpoint ?? '—'}°C
            </span>
          </div>
          {metar.weather.length > 0 && (
            <div className="flex flex-wrap gap-1 px-1">
              {metar.weather.map((wx, i) => (
                <Badge key={i} variant="outline" className="h-4 px-1.5 text-[9px]">
                  {wx}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-1 text-xs text-muted-foreground">No weather data</div>
      )}

      {/* Stats - Compact row */}
      <div className="grid grid-cols-4 gap-1.5">
        <StatBox label="RWY" value={airport.runways.length} />
        <StatBox label="ILS" value={ilsCount} highlight={ilsCount > 0} />
        <StatBox label="PROC" value={sidCount + starCount + approachCount} />
        <StatBox label="RAMP" value={airport.startupLocations?.length ?? 0} />
      </div>

      {/* Frequencies - Compact grid */}
      {topFrequencies.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {topFrequencies.map((freq, i) => (
            <button
              key={i}
              onClick={() => handleCopyFreq(freq.frequency)}
              className="group flex items-center justify-between rounded bg-muted/30 px-2 py-1.5 transition-colors hover:bg-muted/50"
            >
              <span className="text-[10px] text-muted-foreground">
                {FREQ_SHORT[freq.type] || freq.type}
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-foreground">
                  {formatFrequency(freq.frequency)}
                </span>
                <Copy className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Collapsible METAR */}
      {vatsimMetarData?.raw && (
        <div>
          <button
            onClick={() => setShowMetar(!showMetar)}
            className="flex w-full items-center justify-between px-1 py-1 text-left"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              METAR
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-muted-foreground transition-transform',
                showMetar && 'rotate-180'
              )}
            />
          </button>
          {showMetar && (
            <p className="rounded bg-muted/20 p-2 font-mono text-[9px] leading-relaxed text-foreground/60">
              {vatsimMetarData.raw}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: number;
  highlight?: boolean;
}

function StatBox({ label, value, highlight }: StatBoxProps) {
  return (
    <div
      className={cn('rounded px-2 py-1.5 text-center', highlight ? 'bg-primary/10' : 'bg-muted/30')}
    >
      <p
        className={cn(
          'font-mono text-sm font-semibold',
          highlight ? 'text-primary' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// Compact formatters
function formatWind(
  wind: { direction: number | 'VRB'; speed: number; gust?: number } | null
): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'CALM';
  const dir = wind.direction === 'VRB' ? 'VRB' : `${String(wind.direction).padStart(3, '0')}`;
  const gust = wind.gust ? `G${wind.gust}` : '';
  return `${dir}/${wind.speed}${gust}KT`;
}

function formatVisibility(
  vis: { value: number; unit: 'SM' | 'M'; modifier?: 'M' | 'P' } | null
): string {
  if (!vis) return '—';
  if (vis.unit === 'SM') {
    if (vis.value >= 10) return 'P10SM';
    return `${vis.value}SM`;
  }
  if (vis.value >= 9999) return '9999';
  return `${vis.value}M`;
}

function formatCeiling(clouds: Array<{ cover: string; altitude?: number }>): string {
  for (const cloud of clouds) {
    if (
      (cloud.cover === 'BKN' || cloud.cover === 'OVC' || cloud.cover === 'VV') &&
      cloud.altitude
    ) {
      return `${cloud.cover}${String(cloud.altitude).padStart(3, '0')}`;
    }
  }
  const hasClear = clouds.some((c) => ['CLR', 'SKC', 'NSC', 'NCD'].includes(c.cover));
  if (hasClear || clouds.length === 0) return 'CLR';
  return '—';
}

function formatAltimeter(value: number | null, unit: 'inHg' | 'hPa'): string {
  if (value === null) return '—';
  if (unit === 'inHg') return `${value.toFixed(2)}`;
  return `${value}`;
}
