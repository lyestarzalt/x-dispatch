import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { CloudQuantity, DistanceUnit, Intensity } from 'metar-taf-parser';
// Formatters for metar-taf-parser types
import type { IAltimeter, ICloud, IWeatherCondition, IWind, Visibility } from 'metar-taf-parser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFrequency } from '@/lib/utils/format';
import { runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useNavDataQuery } from '@/queries';
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
import type { Frequency, Runway, RunwayEnd } from '@/types/apt';
import { FrequencyType, SurfaceType } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles this import
import gatewayLogo from '../../../../../assets/gateway-logo.svg';

// ---------------------------------------------------------------------------
// Constants — design system tokens only (cat-* category colors, xp-* utility
// classes from index.css, standard shadcn surface tokens).
// ---------------------------------------------------------------------------

const SURFACE_NAMES: Partial<Record<SurfaceType, string>> = {
  [SurfaceType.ASPHALT]: 'Asphalt',
  [SurfaceType.CONCRETE]: 'Concrete',
  [SurfaceType.TURF_OR_GRASS]: 'Grass',
  [SurfaceType.DIRT]: 'Dirt',
  [SurfaceType.GRAVEL]: 'Gravel',
  [SurfaceType.WATER_RUNWAY]: 'Water',
  [SurfaceType.SNOW_OR_ICE]: 'Snow',
};

// Frequencies in flight-flow order: preflight (recorded info) → taxi out
// → departure clearance → tower → en-route control → unicom for non-ATC.
const FREQ_FLIGHT_ORDER: FrequencyType[] = [
  FrequencyType.AWOS, // ATIS / weather (read first)
  FrequencyType.DELIVERY, // clearance
  FrequencyType.GROUND, // taxi
  FrequencyType.TOWER, // takeoff
  FrequencyType.DEPARTURE, // climb-out
  FrequencyType.APPROACH, // arrival
  FrequencyType.CTAF, // non-ATC fallback
];

const FREQ_LABELS: Record<FrequencyType, string> = {
  [FrequencyType.AWOS]: 'ATIS',
  [FrequencyType.DELIVERY]: 'DEL',
  [FrequencyType.GROUND]: 'GND',
  [FrequencyType.TOWER]: 'TWR',
  [FrequencyType.DEPARTURE]: 'DEP',
  [FrequencyType.APPROACH]: 'APP',
  [FrequencyType.CTAF]: 'CTAF',
};

const FREQ_VISIBLE_DEFAULT = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InfoTab() {
  const { t } = useTranslation();
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const isCustom = useAppStore((s) => s.selectedAirportIsCustom);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);
  const ivaoEnabled = useMapStore((s) => s.ivaoEnabled);

  const [showAllFreqs, setShowAllFreqs] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: ivaoData } = useIvaoQuery(ivaoEnabled);
  const { data: navData } = useNavDataQuery(
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null,
    50
  );
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

  // IVAO data
  const ivaoTraffic = useMemo(() => getIvaoTrafficCounts(ivaoData, icao ?? ''), [ivaoData, icao]);

  // Runways sorted by length, descending
  const sortedRunways = useMemo(() => {
    if (!airport?.runways) return [];
    return [...airport.runways].sort(
      (a, b) => runwayLengthFeet(b.ends[0], b.ends[1]) - runwayLengthFeet(a.ends[0], a.ends[1])
    );
  }, [airport?.runways]);

  // Map of runway end name → ILS navaid (so we can show an ILS chip per end)
  const ilsByEnd = useMemo(() => {
    const map = new Map<string, Navaid>();
    if (!navData?.ils) return map;
    for (const ils of navData.ils) {
      if (ils.associatedRunway) map.set(ils.associatedRunway.toUpperCase(), ils);
    }
    return map;
  }, [navData?.ils]);

  // Active runway resolution: ATIS is authoritative when available, wind
  // alignment is a heuristic fallback used only when no ATIS is published.
  const activeRunway = useMemo<ActiveRunway | null>(() => {
    if (vatsimEnabled && atisRunways.length > 0) {
      return { source: 'atis', ends: atisRunways.map((r) => r.toUpperCase()) };
    }
    const wind = metar?.wind;
    if (wind && wind.degrees !== undefined && wind.speed > 0) {
      const best = findPreferredRunwayEnd(sortedRunways, wind.degrees);
      if (best) {
        return {
          source: 'wind',
          ends: [best.endName.toUpperCase()],
          windDeg: wind.degrees,
          windSpeed: wind.speed,
          deltaDeg: best.deltaDeg,
        };
      }
    }
    return null;
  }, [vatsimEnabled, atisRunways, metar?.wind, sortedRunways]);

  // Map VATSIM controllers to the frequency type they cover, so each row in
  // the Frequencies list can show a green pulse dot when the matching
  // controller is logged in.
  const liveControllers = useMemo(() => {
    const set = new Set<FrequencyType>();
    if (!vatsimEnabled) return set;
    for (const c of controllers) {
      const ft = controllerCallsignToFreqType(c.callsign);
      if (ft !== null) set.add(ft);
    }
    if (atis.length > 0) set.add(FrequencyType.AWOS);
    return set;
  }, [vatsimEnabled, controllers, atis]);

  // Combined live traffic chip. Sums VATSIM and IVAO when both are on.
  const liveTraffic = useMemo(() => {
    let dep = 0;
    let arr = 0;
    if (vatsimEnabled) {
      dep += traffic.departures;
      arr += traffic.arrivals;
    }
    if (ivaoEnabled) {
      dep += ivaoTraffic.departures;
      arr += ivaoTraffic.arrivals;
    }
    return dep + arr > 0 ? { departures: dep, arrivals: arr } : null;
  }, [vatsimEnabled, ivaoEnabled, traffic, ivaoTraffic]);

  const atisLetter = vatsimEnabled && primaryAtis?.atis_code ? primaryAtis.atis_code : null;

  // Frequencies sorted into flight-flow order.
  const frequencies = useMemo(() => {
    if (!airport?.frequencies) return [];
    return [...airport.frequencies].sort((a, b) => freqOrderRank(a.type) - freqOrderRank(b.type));
  }, [airport?.frequencies]);

  const visibleFrequencies = showAllFreqs
    ? frequencies
    : frequencies.slice(0, FREQ_VISIBLE_DEFAULT);

  if (!airport) return null;

  return (
    <div className="space-y-4">
      {/* Gateway update banner (kept) */}
      {gatewayUpdate && (
        <Button
          variant="ghost"
          onClick={() => window.appAPI.openExternal(gatewayUpdate.gatewayUrl)}
          className="group h-auto w-full gap-3 border border-primary/15 bg-primary/5 p-3 text-left hover:bg-primary/10"
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
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary/30 group-hover:text-primary/60" />
        </Button>
      )}

      <ConditionsCard
        metar={metar}
        activeRunway={activeRunway}
        atisLetter={atisLetter}
        liveTraffic={liveTraffic}
      />

      {sortedRunways.length > 0 && (
        <RunwaysSection
          runways={sortedRunways}
          ilsByEnd={ilsByEnd}
          activeEndNames={new Set(activeRunway?.ends ?? [])}
        />
      )}

      {frequencies.length > 0 && (
        <FrequenciesSection
          visible={visibleFrequencies}
          totalCount={frequencies.length}
          showAll={showAllFreqs}
          onToggle={() => setShowAllFreqs((v) => !v)}
          liveControllers={liveControllers}
        />
      )}

      {rawMetar && (
        <DetailsSection
          rawMetar={rawMetar}
          expanded={showDetails}
          onToggle={() => setShowDetails((v) => !v)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function ConditionsCard({
  metar,
  activeRunway,
  atisLetter,
  liveTraffic,
}: {
  metar: ParsedMetar | null;
  activeRunway: ActiveRunway | null;
  atisLetter: string | null;
  liveTraffic: { departures: number; arrivals: number } | null;
}) {
  if (!metar && !activeRunway && !liveTraffic) {
    return (
      <div className="rounded-lg bg-muted/10 p-3 text-center text-sm text-muted-foreground">
        No weather data available
      </div>
    );
  }
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="xp-section-heading mb-0 border-b-0">Conditions</h4>
        {liveTraffic && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cat-emerald" />
            <span
              className="flex items-center gap-1 text-cat-emerald"
              aria-label={`${liveTraffic.departures} departures`}
            >
              <ArrowUpRight className="h-3 w-3" />
              <span className="font-mono tabular-nums">{liveTraffic.departures}</span>
            </span>
            <span
              className="flex items-center gap-1 text-cat-amber"
              aria-label={`${liveTraffic.arrivals} arrivals`}
            >
              <ArrowDownLeft className="h-3 w-3" />
              <span className="font-mono tabular-nums">{liveTraffic.arrivals}</span>
            </span>
          </span>
        )}
      </div>
      {metar && (
        <div className="rounded-lg bg-card/40 px-3 py-2.5 text-sm">
          <KvRow label="Wind" value={formatWind(metar.wind)} />
          <KvRow label="Visibility" value={formatVisibility(metar.visibility, metar.cavok)} />
          <KvRow label="Ceiling" value={formatCeiling(metar.clouds, metar.verticalVisibility)} />
          <KvRow label="QNH" value={formatAltimeter(metar.altimeter)} />
          <KvRow
            label="Temp / Dew"
            value={`${metar.temperature ?? '—'}°C / ${metar.dewPoint ?? '—'}°C`}
          />
          {metar.weatherConditions.length > 0 && (
            <KvRow label="Phenomena" value={formatWeatherConditions(metar.weatherConditions)} />
          )}
        </div>
      )}
      <ActiveRunwayLine activeRunway={activeRunway} atisLetter={atisLetter} />
    </section>
  );
}

function ActiveRunwayLine({
  activeRunway,
  atisLetter,
}: {
  activeRunway: ActiveRunway | null;
  atisLetter: string | null;
}) {
  if (!activeRunway) return null;
  const isAtis = activeRunway.source === 'atis';
  // ATIS path shows the letter chip — its presence signals "ATC online".
  // Wind path stays muted; the missing chip is the implicit "no ATC" cue.
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs">
      <span className="text-muted-foreground">Active runway</span>
      <span
        className={cn('font-mono font-medium', isAtis ? 'text-cat-emerald' : 'text-foreground')}
      >
        {activeRunway.ends.join(', ')}
      </span>
      {isAtis && atisLetter && (
        <Badge variant="cat-emerald" className="h-4 px-1.5 font-mono text-[10px]">
          ATIS {atisLetter}
        </Badge>
      )}
      {!isAtis && (
        <span className="text-muted-foreground/60">
          · wind-aligned, {activeRunway.deltaDeg}° off
        </span>
      )}
    </div>
  );
}

function RunwaysSection({
  runways,
  ilsByEnd,
  activeEndNames,
}: {
  runways: Runway[];
  ilsByEnd: Map<string, Navaid>;
  activeEndNames: Set<string>;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="xp-section-heading mb-0 border-b-0">Runways</h4>
        <span className="text-xs text-muted-foreground">{runways.length} total</span>
      </div>
      <ul className="space-y-1">
        {runways.map((rwy, i) => (
          <RunwayRow key={i} runway={rwy} ilsByEnd={ilsByEnd} activeEndNames={activeEndNames} />
        ))}
      </ul>
    </section>
  );
}

function RunwayRow({
  runway,
  ilsByEnd,
  activeEndNames,
}: {
  runway: Runway;
  ilsByEnd: Map<string, Navaid>;
  activeEndNames: Set<string>;
}) {
  const length = Math.round(runwayLengthFeet(runway.ends[0], runway.ends[1]));
  // Use an em-dash for missing surface metadata so the row stays scannable
  // without drawing attention to "Unknown" data.
  const surface = SURFACE_NAMES[runway.surface_type] ?? '—';
  const ils0 = ilsByEnd.get(runway.ends[0].name.toUpperCase());
  const ils1 = ilsByEnd.get(runway.ends[1].name.toUpperCase());
  const hasIls = Boolean(ils0 || ils1);
  const isActive =
    activeEndNames.has(runway.ends[0].name.toUpperCase()) ||
    activeEndNames.has(runway.ends[1].name.toUpperCase());

  return (
    <li
      className={cn(
        'rounded px-2.5 py-1.5',
        isActive ? 'bg-cat-emerald/10 ring-1 ring-cat-emerald/30' : 'bg-muted/20'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'font-mono text-sm font-medium',
            isActive ? 'text-cat-emerald' : 'text-foreground'
          )}
        >
          {runway.ends[0].name}/{runway.ends[1].name}
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasIls && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
              ILS
            </span>
          )}
          <span className="font-mono tabular-nums">{length.toLocaleString()}'</span>
          <span className="text-muted-foreground/70">{surface}</span>
        </div>
      </div>
    </li>
  );
}

function FrequenciesSection({
  visible,
  totalCount,
  showAll,
  onToggle,
  liveControllers,
}: {
  visible: Frequency[];
  totalCount: number;
  showAll: boolean;
  onToggle: () => void;
  liveControllers: Set<FrequencyType>;
}) {
  const hidden = totalCount - visible.length;
  const collapsible = totalCount > FREQ_VISIBLE_DEFAULT;

  return (
    <section>
      <h4 className="xp-section-heading mb-1.5">Frequencies</h4>
      <ul className="space-y-px overflow-hidden rounded-lg">
        {visible.map((f, i) => (
          <FrequencyRow key={i} freq={f} live={liveControllers.has(f.type)} />
        ))}
      </ul>
      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="mt-1 h-7 w-full justify-center text-xs text-muted-foreground hover:text-foreground"
        >
          {showAll ? 'Show fewer' : `Show all (${hidden} more)`}
        </Button>
      )}
    </section>
  );
}

function FrequencyRow({ freq, live }: { freq: Frequency; live: boolean }) {
  const value = formatFrequency(freq.frequency);
  const label = FREQ_LABELS[freq.type];
  // Hide the per-frequency name when it just repeats the type label
  // (e.g. "ATIS" + name "ATIS"). Keep it when it adds context like
  // "KENNEDY GND" or "CLNC DEL" (controller / authority disambiguation).
  const showName = !!freq.name && freq.name.trim().toUpperCase() !== label.toUpperCase();
  const handleCopy = () => navigator.clipboard.writeText(value);
  return (
    <li>
      <Button
        variant="ghost"
        onClick={handleCopy}
        className="group h-auto w-full justify-between rounded-none bg-muted/20 px-2.5 py-1.5 text-left hover:bg-muted/40"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {live && (
            <Radio
              aria-label="Controller online"
              className="h-3 w-3 shrink-0 animate-pulse text-cat-emerald"
            />
          )}
          {label}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {showName && (
            <span className="truncate text-xs text-muted-foreground/70">{freq.name}</span>
          )}
          <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
          <Copy className="h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
        </div>
      </Button>
    </li>
  );
}

function DetailsSection({
  rawMetar,
  expanded,
  onToggle,
}: {
  rawMetar: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-7 w-full justify-start gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Raw METAR
      </Button>
      {expanded && (
        <div className="mt-1.5 rounded bg-muted/30 p-2">
          <p className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
            {rawMetar}
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="xp-label">{label}</span>
      <span className="xp-value tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — METAR formatting
// ---------------------------------------------------------------------------

// Re-typed inline because metar-taf-parser doesn't export the parsed shape;
// we just borrow the field set the hook already returns.
type ParsedMetar = NonNullable<ReturnType<typeof useVatsimMetarQuery>['data']>['parsed'];

function freqOrderRank(type: FrequencyType): number {
  const idx = FREQ_FLIGHT_ORDER.indexOf(type);
  return idx === -1 ? 999 : idx;
}

function formatWind(wind: IWind | undefined): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'CALM';
  const dir = wind.degrees !== undefined ? `${String(wind.degrees).padStart(3, '0')}°` : 'VRB';
  const gust = wind.gust ? `G${wind.gust}` : '';
  return `${dir} / ${wind.speed}${gust}kt`;
}

function formatVisibility(vis: Visibility | undefined, cavok?: true): string {
  if (cavok) return 'CAVOK';
  if (!vis) return '—';
  if (vis.unit === DistanceUnit.StatuteMiles) {
    if (vis.value >= 10) return '>10 SM';
    return `${vis.value} SM`;
  }
  if (vis.value >= 9999) return '>10 km';
  return `${(vis.value / 1000).toFixed(1)} km`;
}

function formatCeiling(clouds: ICloud[], verticalVisibility?: number): string {
  if (verticalVisibility !== undefined) {
    return `VV ${String(verticalVisibility).padStart(3, '0')}`;
  }
  for (const cloud of clouds) {
    if (
      (cloud.quantity === CloudQuantity.BKN || cloud.quantity === CloudQuantity.OVC) &&
      cloud.height !== undefined
    ) {
      return `${cloud.quantity} ${cloud.height.toLocaleString()} ft`;
    }
  }
  const hasClear = clouds.some(
    (c) => c.quantity === CloudQuantity.SKC || c.quantity === CloudQuantity.NSC
  );
  if (hasClear || clouds.length === 0) return 'Clear';
  if (clouds[0]?.height !== undefined) {
    return `${clouds[0].quantity} ${clouds[0].height.toLocaleString()} ft`;
  }
  return '—';
}

function formatAltimeter(alt: IAltimeter | undefined): string {
  if (!alt) return '—';
  if (alt.unit === 'inHg') return `${alt.value.toFixed(2)} "Hg`;
  return `${alt.value} hPa`;
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

// ---------------------------------------------------------------------------
// Helpers — runway / wind alignment
// ---------------------------------------------------------------------------

interface PreferredEnd {
  endName: string;
  deltaDeg: number;
}

/**
 * Active runway resolved for the panel. `source` records where it came from
 * so the UI can label "ATIS" (authoritative) vs "wind-aligned" (heuristic).
 * `ends` is upper-cased so set-membership checks work without re-casing
 * downstream.
 */
type ActiveRunway =
  | { source: 'atis'; ends: string[] }
  | {
      source: 'wind';
      ends: string[];
      windDeg: number;
      windSpeed: number;
      deltaDeg: number;
    };

/**
 * Map a VATSIM controller callsign (e.g. "EHAM_TWR", "EHAM_E_GND",
 * "KSEA_TWR") to the apt.dat frequency role it covers, so the matching row
 * in the Frequencies list can show a live indicator. Returns null for
 * callsigns we don't know how to match (typically center/FSS/etc., which
 * aren't apt.dat frequency types).
 */
function controllerCallsignToFreqType(callsign: string): FrequencyType | null {
  const upper = callsign.toUpperCase();
  if (upper.endsWith('_TWR')) return FrequencyType.TOWER;
  if (upper.endsWith('_GND')) return FrequencyType.GROUND;
  if (upper.endsWith('_APP')) return FrequencyType.APPROACH;
  if (upper.endsWith('_DEP')) return FrequencyType.DEPARTURE;
  if (upper.endsWith('_DEL') || upper.endsWith('_CLR')) return FrequencyType.DELIVERY;
  if (upper.endsWith('_ATIS')) return FrequencyType.AWOS;
  return null;
}

/**
 * Pick the runway end whose published heading is most closely aligned with
 * the wind direction (head-wind landing). Reads the heading from the runway
 * end name (e.g. "13L" → 130°). Returns null if no runways exist.
 */
function findPreferredRunwayEnd(runways: Runway[], windDeg: number): PreferredEnd | null {
  let best: PreferredEnd | null = null;
  for (const rwy of runways) {
    for (const end of rwy.ends) {
      const heading = runwayEndHeading(end);
      if (heading === null) continue;
      let delta = Math.abs(heading - windDeg);
      if (delta > 180) delta = 360 - delta;
      if (best === null || delta < best.deltaDeg) {
        best = { endName: end.name, deltaDeg: Math.round(delta) };
      }
    }
  }
  return best;
}

function runwayEndHeading(end: RunwayEnd): number | null {
  // Strip suffix (L/R/C/W/S/T) and parse the leading two digits as 10s of degrees.
  const m = end.name.match(/^(\d{1,2})/);
  if (!m || !m[1]) return null;
  const tens = parseInt(m[1], 10);
  if (!Number.isFinite(tens)) return null;
  return tens * 10;
}
