import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react';
import { CloudQuantity, DistanceUnit, Intensity } from 'metar-taf-parser';
import type { IAltimeter, ICloud, IWeatherCondition, IWind, Visibility } from 'metar-taf-parser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFrequency } from '@/lib/utils/format';
import { runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { buildAirportAtcRows } from '@/lib/vatsimSectors/airportAtc';
import { useNavDataQuery } from '@/queries';
import { useGatewayUpdateCheck } from '@/queries/useGatewayQuery';
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
import type { VatsimAirportAtcRow, VatsimFacilityRole } from '@/types/vatsimSectors';
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

  const [showAllFreqs, setShowAllFreqs] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: navData } = useNavDataQuery(
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null,
    50
  );
  const { data: gatewayUpdate } = useGatewayUpdateCheck(icao, isCustom);

  const metar = vatsimMetarData?.parsed ?? null;
  const rawMetar = vatsimMetarData?.raw ?? null;
  const airportCallsignMatch = useMemo(
    () => ({
      icao: icao ?? '',
      iata: airport?.metadata?.iata_code ?? null,
    }),
    [airport?.metadata?.iata_code, icao]
  );

  // VATSIM data
  const atis = useMemo(
    () => getATISForAirport(vatsimData, airportCallsignMatch),
    [airportCallsignMatch, vatsimData]
  );
  const controllers = useMemo(
    () => getControllersForAirport(vatsimData, airportCallsignMatch),
    [airportCallsignMatch, vatsimData]
  );
  const traffic = useMemo(
    () => getTrafficCountsForAirport(vatsimData, icao ?? ''),
    [vatsimData, icao]
  );
  const primaryAtis = atis[0];
  const atisRunways = primaryAtis ? parseATISRunways(primaryAtis) : [];
  const atisLetter = vatsimEnabled && primaryAtis?.atis_code ? primaryAtis.atis_code : null;
  const vatsimRows = useMemo(() => buildAirportAtcRows(controllers, atis), [controllers, atis]);
  const liveTraffic = vatsimEnabled
    ? { departures: traffic.departures, arrivals: traffic.arrivals }
    : null;

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

  // Frequencies sorted into flight-flow order. apt.dat sometimes lists the
  // same physical channel twice (legacy 25 kHz row + 8.33 kHz row), so we
  // dedupe by (type, frequency) to avoid rendering twin rows where one
  // attaches a live VATSIM controller and the other appears offline.
  const frequencies = useMemo(() => {
    if (!airport?.frequencies) return [];
    const sorted = [...airport.frequencies].sort(
      (a, b) => freqOrderRank(a.type) - freqOrderRank(b.type)
    );
    const seen = new Set<string>();
    return sorted.filter((f) => {
      const key = `${f.type}-${f.frequency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [airport?.frequencies]);

  // Merge static apt.dat frequencies with live VATSIM rows. Each static row
  // attaches the first matching VATSIM controller; unmatched VATSIM rows
  // (CTR, FSS, extra controllers on the same role) append at the end.
  const mergedFreqRows = useMemo<MergedFreqRow[]>(
    () => mergeFreqRows(frequencies, vatsimEnabled ? vatsimRows : []),
    [frequencies, vatsimEnabled, vatsimRows]
  );

  const visibleMergedRows = showAllFreqs
    ? mergedFreqRows
    : mergedFreqRows.slice(0, FREQ_VISIBLE_DEFAULT);

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

      {mergedFreqRows.length > 0 && (
        <FrequenciesSection
          visible={visibleMergedRows}
          totalCount={mergedFreqRows.length}
          showAll={showAllFreqs}
          onToggle={() => setShowAllFreqs((v) => !v)}
          vatsimEnabled={vatsimEnabled}
          onlineCount={vatsimRows.length}
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
  const showTraffic = liveTraffic && (liveTraffic.departures > 0 || liveTraffic.arrivals > 0);
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="xp-section-heading mb-0 border-b-0">Conditions</h4>
        {showTraffic && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="flex items-center gap-1 text-cat-emerald"
              aria-label={`${liveTraffic.departures} departures`}
            >
              <PlaneTakeoff className="h-3 w-3" />
              <span className="font-mono tabular-nums">{liveTraffic.departures}</span>
            </span>
            <span
              className="flex items-center gap-1 text-cat-amber"
              aria-label={`${liveTraffic.arrivals} arrivals`}
            >
              <PlaneLanding className="h-3 w-3" />
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

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="xp-label">{label}</span>
      <span className="xp-value tabular-nums">{value}</span>
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
  vatsimEnabled,
  onlineCount,
}: {
  visible: MergedFreqRow[];
  totalCount: number;
  showAll: boolean;
  onToggle: () => void;
  vatsimEnabled: boolean;
  onlineCount: number;
}) {
  const { t } = useTranslation();
  const hidden = totalCount - visible.length;
  const collapsible = totalCount > FREQ_VISIBLE_DEFAULT;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h4 className="xp-section-heading mb-0 border-b-0">
          {t('airportInfo.frequencies', 'Frequencies')}
        </h4>
        {vatsimEnabled && onlineCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cat-emerald" />
            <span>
              <span className="font-mono tabular-nums text-foreground">{onlineCount}</span>{' '}
              {t('common.online')}
            </span>
          </span>
        )}
      </div>
      <ul className="space-y-1 overflow-hidden rounded-lg">
        {visible.map((row) => (
          <FrequencyRow
            key={row.id}
            row={row}
            expanded={expandedIds.has(row.id)}
            onToggle={() => toggleExpand(row.id)}
          />
        ))}
      </ul>
      {collapsible && (
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="mt-2 h-8 w-full justify-center gap-1.5 border-border/60 bg-muted/10 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        >
          {showAll ? (
            <>
              <ChevronDown className="h-3 w-3 rotate-180" />
              {t('common.showLess', 'Show less')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t('common.showAll', 'Show all')} · {hidden} {t('sidebar.more')}
            </>
          )}
        </Button>
      )}
    </section>
  );
}

function FrequencyRow({
  row,
  expanded,
  onToggle,
}: {
  row: MergedFreqRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const live = row.live;
  const displayFreq = live?.frequency ?? row.staticFreq ?? '';
  const showName =
    !!row.staticName && row.staticName.trim().toUpperCase() !== row.label.toUpperCase();
  const hasAtisBody = !!live?.atisBody;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayFreq) navigator.clipboard.writeText(displayFreq);
  };

  const onClick = hasAtisBody ? onToggle : handleCopy;

  return (
    <li>
      <Button
        variant="ghost"
        onClick={onClick}
        className={cn(
          'group h-auto w-full flex-col items-stretch gap-0 rounded-md px-2.5 py-1.5 text-left',
          live
            ? 'bg-cat-emerald/5 ring-1 ring-cat-emerald/25 hover:bg-cat-emerald/10'
            : 'bg-muted/20 hover:bg-muted/40'
        )}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {live ? (
              <span className="relative flex h-1.5 w-1.5 shrink-0" aria-label={t('common.online')}>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cat-emerald/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cat-emerald" />
              </span>
            ) : (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
            )}
            <Badge
              variant={live ? row.badgeVariant : 'outline'}
              className="shrink-0 px-1.5 py-0 font-mono text-[10px] font-semibold uppercase"
            >
              {live?.badgeLabel ?? row.label}
            </Badge>
            {showName && (
              <span className="truncate text-xs text-muted-foreground/70">{row.staticName}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                live ? 'text-info' : 'text-foreground'
              )}
            >
              {displayFreq}
            </span>
            {hasAtisBody ? (
              <ChevronDown
                className={cn(
                  'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            ) : (
              <Copy
                className="h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (displayFreq) navigator.clipboard.writeText(displayFreq);
                }}
              />
            )}
          </div>
        </div>
        {live && (
          <div className="mt-0.5 flex items-center gap-1.5 pl-[1.65rem] text-[11px] text-muted-foreground">
            <span className="font-mono text-foreground/80">{live.callsign}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate">{live.controllerName}</span>
          </div>
        )}
        {hasAtisBody && expanded && (
          <pre className="mt-1 whitespace-pre-wrap pl-[1.65rem] font-mono text-[11px] leading-relaxed text-muted-foreground">
            {live?.atisBody}
          </pre>
        )}
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

function freqOrderRank(type: FrequencyType): number {
  const idx = FREQ_FLIGHT_ORDER.indexOf(type);
  return idx === -1 ? 999 : idx;
}

// ---------------------------------------------------------------------------
// Helpers — METAR formatting
// ---------------------------------------------------------------------------

// Re-typed inline because metar-taf-parser doesn't export the parsed shape;
// we just borrow the field set the hook already returns.
type ParsedMetar = NonNullable<ReturnType<typeof useVatsimMetarQuery>['data']>['parsed'];

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
    .join(', ');
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
 * Map a VATSIM facility role to the apt.dat frequency type it usually covers.
 * Returns null for roles that don't have an apt.dat counterpart (CTR, FSS,
 * OTHER) — those become "extra" rows appended after the static frequency
 * list.
 */
function facilityRoleToFreqType(role: VatsimFacilityRole): FrequencyType | null {
  switch (role) {
    case 'DEL':
      return FrequencyType.DELIVERY;
    case 'GND':
      return FrequencyType.GROUND;
    case 'TWR':
      return FrequencyType.TOWER;
    case 'APP':
      return FrequencyType.APPROACH;
    case 'ATIS':
      return FrequencyType.AWOS;
    default:
      return null;
  }
}

/**
 * Renderer-shape row for the merged Frequencies list. A row is either:
 *  - a static apt.dat frequency, optionally enriched with a matched live
 *    VATSIM controller (`live` populated)
 *  - a VATSIM-only "extra" (CTR, FSS, additional same-role controllers)
 *    where there's no static counterpart (`staticName` / `staticFreq` undefined,
 *    `live` always populated).
 */
interface MergedFreqRow {
  id: string;
  label: string;
  badgeVariant: VatsimAirportAtcRow['badgeVariant'];
  staticName?: string;
  staticFreq?: string;
  live?: {
    badgeLabel: string;
    callsign: string;
    controllerName: string;
    frequency: string;
    atisBody?: string;
  };
}

function mergeFreqRows(
  staticFreqs: Frequency[],
  vatsimRows: VatsimAirportAtcRow[]
): MergedFreqRow[] {
  const usedVatsimIds = new Set<string>();
  const result: MergedFreqRow[] = [];

  // Pass 1: each static row attaches the first VATSIM row whose role matches.
  for (let i = 0; i < staticFreqs.length; i++) {
    const f = staticFreqs[i];
    if (!f) continue;
    const match = vatsimRows.find(
      (r) => !usedVatsimIds.has(r.id) && facilityRoleToFreqType(r.role) === f.type
    );
    if (match) usedVatsimIds.add(match.id);
    result.push({
      id: match ? match.id : `static-${i}-${f.type}`,
      label: FREQ_LABELS[f.type],
      badgeVariant: match ? match.badgeVariant : 'secondary',
      staticName: f.name,
      staticFreq: formatFrequency(f.frequency),
      live: match
        ? {
            badgeLabel: match.badgeLabel,
            callsign: match.callsign,
            controllerName: match.summary,
            frequency: match.frequency,
            atisBody: match.detail,
          }
        : undefined,
    });
  }

  // Pass 2: VATSIM rows that didn't match any static row (CTR, FSS, extras).
  for (const r of vatsimRows) {
    if (usedVatsimIds.has(r.id)) continue;
    result.push({
      id: r.id,
      label: r.badgeLabel,
      badgeVariant: r.badgeVariant,
      live: {
        badgeLabel: r.badgeLabel,
        callsign: r.callsign,
        controllerName: r.summary,
        frequency: r.frequency,
        atisBody: r.detail,
      },
    });
  }

  return result;
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
