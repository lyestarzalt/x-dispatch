import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, Plane, Radio } from 'lucide-react';
import { CloudQuantity, Descriptive, DistanceUnit, Intensity, Phenomenon } from 'metar-taf-parser';
// Formatters for metar-taf-parser types
import type { IAltimeter, ICloud, IWeatherCondition, IWind, Visibility } from 'metar-taf-parser';
import { Badge } from '@/components/ui/badge';
import { formatFrequency } from '@/lib/utils/format';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAirportProcedures, useNavDataQuery } from '@/queries';
import { useGatewayUpdateCheck } from '@/queries/useGatewayQuery';
import {
  getTrafficCountsForAirport as getIvaoTrafficCounts,
  useIvaoQuery,
} from '@/queries/useIvaoQuery';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import {
  getATISForAirport,
  getControllersForAirport,
  getTrafficCountsForAirport,
  parseATISRunways,
  useVatsimQuery,
} from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import type { Frequency } from '@/types/apt';
import { FrequencyType, SurfaceType } from '@/types/apt';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles this import
import gatewayLogo from '../../../../../assets/gateway-logo.svg';

const SURFACE_NAMES: Partial<Record<SurfaceType, string>> = {
  [SurfaceType.ASPHALT]: 'Asphalt',
  [SurfaceType.CONCRETE]: 'Concrete',
  [SurfaceType.TURF_OR_GRASS]: 'Grass',
  [SurfaceType.DIRT]: 'Dirt',
  [SurfaceType.GRAVEL]: 'Gravel',
  [SurfaceType.WATER_RUNWAY]: 'Water',
  [SurfaceType.SNOW_OR_ICE]: 'Snow',
};

const FREQ_PRIORITY: FrequencyType[] = [
  FrequencyType.TOWER,
  FrequencyType.GROUND,
  FrequencyType.APPROACH,
  FrequencyType.DELIVERY,
  FrequencyType.CTAF,
  FrequencyType.AWOS,
  FrequencyType.UNICOM,
];

const FREQ_LABELS: Partial<Record<FrequencyType, string>> = {
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
  const { t } = useTranslation();
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const isCustom = useAppStore((s) => s.selectedAirportIsCustom);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);
  const ivaoEnabled = useMapStore((s) => s.ivaoEnabled);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: ivaoData } = useIvaoQuery(ivaoEnabled);
  const { data: navData } = useNavDataQuery(
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null,
    50
  );
  const { data: procedures } = useAirportProcedures(icao);
  const { data: gatewayUpdate } = useGatewayUpdateCheck(icao, isCustom);

  const metar = vatsimMetarData?.parsed ?? null;
  const rawMetar = vatsimMetarData?.raw ?? null;

  // VATSIM data
  const atis = useMemo(() => getATISForAirport(vatsimData, icao ?? ''), [vatsimData, icao]);
  const controllers = useMemo(
    () => getControllersForAirport(vatsimData, icao ?? ''),
    [vatsimData, icao]
  );
  const traffic = useMemo(
    () => getTrafficCountsForAirport(vatsimData, icao ?? ''),
    [vatsimData, icao]
  );
  const primaryAtis = atis[0];
  const atisRunways = primaryAtis ? parseATISRunways(primaryAtis) : [];
  const hasVatsimActivity =
    controllers.length > 0 || atis.length > 0 || traffic.departures > 0 || traffic.arrivals > 0;

  // IVAO data
  const ivaoTraffic = useMemo(() => getIvaoTrafficCounts(ivaoData, icao ?? ''), [ivaoData, icao]);
  const hasIvaoActivity = ivaoTraffic.departures > 0 || ivaoTraffic.arrivals > 0;

  // Runways sorted by length
  const sortedRunways = useMemo(() => {
    if (!airport?.runways) return [];
    return [...airport.runways].sort((a, b) => {
      const lenA = runwayLengthFeet(a.ends[0], a.ends[1]);
      const lenB = runwayLengthFeet(b.ends[0], b.ends[1]);
      return lenB - lenA;
    });
  }, [airport?.runways]);

  // Get frequencies sorted by priority
  const frequencies = useMemo(() => {
    if (!airport?.frequencies) return [];
    const freqMap = new Map<FrequencyType, Frequency[]>();
    for (const freq of airport.frequencies) {
      const existing = freqMap.get(freq.type) ?? [];
      freqMap.set(freq.type, [...existing, freq]);
    }
    const result: Frequency[] = [];
    for (const type of FREQ_PRIORITY) {
      const freqs = freqMap.get(type);
      if (freqs) result.push(...freqs);
    }
    return result.slice(0, 6); // Max 6 frequencies
  }, [airport?.frequencies]);

  // Counts
  const ilsCount = navData?.ils.length ?? 0;
  const sidCount = procedures?.sids.length ?? 0;
  const starCount = procedures?.stars.length ?? 0;
  const approachCount = procedures?.approaches.length ?? 0;
  const procCount = sidCount + starCount + approachCount;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!airport) return null;

  return (
    <div className="space-y-4">
      {/* Gateway Update */}
      {gatewayUpdate && (
        <button
          onClick={() => window.appAPI.openExternal(gatewayUpdate.gatewayUrl)}
          className="group flex w-full items-center gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
        >
          <img
            src={gatewayLogo}
            alt=""
            className="h-5 w-auto shrink-0 opacity-50 transition-opacity group-hover:opacity-70"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-primary">{t('airportInfo.gateway.updateAvailable')}</p>
            {(gatewayUpdate.artistName || gatewayUpdate.dateApproved) && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {t('airportInfo.gateway.credit', {
                  artist: gatewayUpdate.artistName,
                  date: gatewayUpdate.dateApproved
                    ? new Date(gatewayUpdate.dateApproved).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '',
                })}
              </p>
            )}
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary/30 transition-colors group-hover:text-primary/60" />
        </button>
      )}

      {/* VATSIM Live Section */}
      {vatsimEnabled && hasVatsimActivity && (
        <div className="rounded-lg border border-cat-emerald/20 bg-cat-emerald/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cat-emerald" />
              <span className="text-xs font-medium text-cat-emerald">VATSIM LIVE</span>
            </div>
            {(traffic.departures > 0 || traffic.arrivals > 0) && (
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="flex items-center gap-1 text-cat-emerald">
                  <Plane className="h-3 w-3 rotate-45" />
                  {traffic.departures}
                </span>
                <span className="flex items-center gap-1 text-cat-amber">
                  <Plane className="h-3 w-3 -rotate-45" />
                  {traffic.arrivals}
                </span>
              </div>
            )}
          </div>

          {/* ATC Online */}
          {controllers.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {controllers.map((atc) => (
                <Badge
                  key={atc.callsign}
                  variant="secondary"
                  className="gap-1 bg-cat-emerald/20 text-[10px] text-cat-emerald"
                >
                  <Radio className="h-2.5 w-2.5" />
                  {atc.callsign.split('_')[1] || atc.callsign}
                </Badge>
              ))}
            </div>
          )}

          {/* ATIS */}
          {primaryAtis && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-sm font-bold">
                {primaryAtis.atis_code || '?'}
              </Badge>
              <span className="text-sm text-muted-foreground">ATIS</span>
              {atisRunways.length > 0 && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="font-mono text-sm text-foreground">
                    RWY {atisRunways.join(', ')}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* IVAO Live Section */}
      {ivaoEnabled && hasIvaoActivity && (
        <div className="rounded-lg border border-cat-blue/20 bg-cat-blue/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cat-blue" />
              <span className="text-xs font-medium text-cat-blue">IVAO LIVE</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="flex items-center gap-1 text-cat-blue">
                <Plane className="h-3 w-3 rotate-45" />
                {ivaoTraffic.departures}
              </span>
              <span className="flex items-center gap-1 text-cat-amber">
                <Plane className="h-3 w-3 -rotate-45" />
                {ivaoTraffic.arrivals}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Weather */}
      {metar ? (
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Weather
          </div>
          <div className="space-y-2">
            {/* Raw METAR */}
            <div className="rounded bg-muted/30 p-2">
              <p className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
                {rawMetar}
              </p>
            </div>
            {/* Decoded weather */}
            <div className="rounded-lg bg-muted/20 p-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-foreground">
                <span>{formatWind(metar.wind)}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>{formatVisibility(metar.visibility, metar.cavok)}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>{formatCeiling(metar.clouds, metar.verticalVisibility)}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>QNH {formatAltimeter(metar.altimeter)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {metar.temperature ?? '—'}°C / {metar.dewPoint ?? '—'}°C
                </span>
                {metar.weatherConditions.length > 0 && (
                  <span className="font-mono">
                    {formatWeatherConditions(metar.weatherConditions)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/10 p-3 text-center text-sm text-muted-foreground">
          No weather data available
        </div>
      )}

      {/* Runways */}
      {sortedRunways.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Runways
          </div>
          <div className="space-y-1">
            {sortedRunways.map((rwy, i) => {
              const length = Math.round(runwayLengthFeet(rwy.ends[0], rwy.ends[1]));
              const width = Math.round(metersToFeet(rwy.width));
              const surface = SURFACE_NAMES[rwy.surface_type] || 'Unknown';

              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded bg-muted/20 px-2.5 py-1.5"
                >
                  <span className="font-mono text-sm font-medium text-foreground">
                    {rwy.ends[0].name}/{rwy.ends[1].name}
                  </span>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-mono">{length.toLocaleString()}'</span>
                    <span>{surface}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Frequencies */}
      {frequencies.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Frequencies
          </div>
          <div className="grid grid-cols-2 gap-1">
            {frequencies.map((freq, i) => (
              <button
                key={i}
                onClick={() => handleCopy(formatFrequency(freq.frequency))}
                className="group flex items-center justify-between rounded bg-muted/20 px-2.5 py-1.5 transition-colors hover:bg-muted/40"
              >
                <span className="text-[10px] text-muted-foreground">
                  {FREQ_LABELS[freq.type] || freq.type}
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm text-foreground">
                    {formatFrequency(freq.frequency)}
                  </span>
                  <Copy className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2">
        <StatItem label="RWY" value={airport.runways.length} />
        <div className="h-4 w-px bg-border/50" />
        <StatItem label="ILS" value={ilsCount} highlight={ilsCount > 0} />
        <div className="h-4 w-px bg-border/50" />
        <StatItem label="PROC" value={procCount} />
        <div className="h-4 w-px bg-border/50" />
        <StatItem label="Gates" value={airport.startupLocations?.length ?? 0} />
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
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

function formatWind(wind: IWind | undefined): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'CALM';
  const dir = wind.degrees !== undefined ? `${String(wind.degrees).padStart(3, '0')}°` : 'VRB';
  const gust = wind.gust ? `G${wind.gust}` : '';
  return `${dir}/${wind.speed}${gust}kt`;
}

function formatVisibility(vis: Visibility | undefined, cavok?: true): string {
  if (cavok) return 'CAVOK';
  if (!vis) return '—';
  if (vis.unit === DistanceUnit.StatuteMiles) {
    if (vis.value >= 10) return '>10SM';
    return `${vis.value}SM`;
  }
  // Meters
  if (vis.value >= 9999) return '>10km';
  return `${(vis.value / 1000).toFixed(1)}km`;
}

function formatCeiling(clouds: ICloud[], verticalVisibility?: number): string {
  // Check vertical visibility first
  if (verticalVisibility !== undefined) {
    return `VV${String(verticalVisibility).padStart(3, '0')}`;
  }
  // Find ceiling (BKN or OVC)
  for (const cloud of clouds) {
    if (
      (cloud.quantity === CloudQuantity.BKN || cloud.quantity === CloudQuantity.OVC) &&
      cloud.height !== undefined
    ) {
      return `${cloud.quantity}${String(cloud.height).padStart(3, '0')}`;
    }
  }
  // Check for clear conditions
  const hasClear = clouds.some(
    (c) => c.quantity === CloudQuantity.SKC || c.quantity === CloudQuantity.NSC
  );
  if (hasClear || clouds.length === 0) return 'CLR';
  // Show lowest cloud layer
  if (clouds[0]?.height !== undefined) {
    return `${clouds[0].quantity}${String(clouds[0].height).padStart(3, '0')}`;
  }
  return '—';
}

function formatAltimeter(alt: IAltimeter | undefined): string {
  if (!alt) return '—';
  if (alt.unit === 'inHg') return `${alt.value.toFixed(2)}"`;
  return `${alt.value}hPa`;
}

function formatWeatherConditions(conditions: IWeatherCondition[]): string {
  return conditions
    .map((c) => {
      let str = '';
      if (c.intensity === Intensity.LIGHT) str += '-';
      else if (c.intensity === Intensity.HEAVY) str += '+';
      else if (c.intensity === Intensity.IN_VICINITY) str += 'VC';
      if (c.descriptive) str += c.descriptive;
      str += c.phenomenons.join('');
      return str;
    })
    .join(' ');
}
