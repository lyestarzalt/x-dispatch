import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { packForAirport } from '@/lib/addonManager/scenery/conflicts';
import {
  ATC_ROLE_BADGE_VARIANTS,
  type AtcBadgeVariant,
  stationLabel,
} from '@/lib/networkTraffic/atcRoles';
import { airportRunwayUse } from '@/lib/networkTraffic/atis';
import { formatFrequency } from '@/lib/utils/format';
import { runwayLengthFeet } from '@/lib/utils/geomath';
import { toastError } from '@/lib/utils/toastError';
import { useAirportATC, useNavDataQuery } from '@/queries';
import { useSceneryList } from '@/queries/useAddonManager';
import {
  GatewayActionError,
  useGatewayInstall,
  useGatewayRemove,
  useGatewayUpdateCheck,
} from '@/queries/useGatewayQuery';
import { useNetworkTraffic } from '@/queries/useNetworkTraffic';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import type { Frequency, Runway, RunwayEnd } from '@/types/apt';
import { FrequencyType } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import type { AtcRole, NetworkStation } from '@/types/networkTraffic';
import type { Degrees } from '@/types/units';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles this import
import gatewayLogo from '../../../../../assets/gateway-logo.svg';
import { type ActiveRunway, activeEndUse } from './info/ActiveRunwayLine';
import { ChartsSection } from './info/ChartsSection';
import { ConditionsCard } from './info/ConditionsCard';
import { DetailsSection } from './info/DetailsSection';
import { FREQ_VISIBLE_DEFAULT, FrequenciesSection } from './info/FrequenciesSection';
import { type MergedFreqRow } from './info/FrequencyRow';
import { RunwaysSection } from './info/RunwaysSection';
import {
  activeRunwaysFirst,
  compactFreqRows,
  compactRunways,
  liveRowsFirst,
} from './info/listOrder';
import { runwayEndKey } from './info/runwayEndKey';

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Index navaid records by the runway end they serve, keeping only those that
 * belong to `icao`. A record without an airport (older or hand-edited nav
 * files) is kept, so a lone ILS does not vanish over a missing field. Keys
 * are `runwayEndKey`s, so callers must look up with the same.
 */
export function byRunwayEnd(
  records: Navaid[] | undefined,
  icao: string | null
): Map<string, Navaid> {
  const map = new Map<string, Navaid>();
  if (!records) return map;
  const here = icao?.toUpperCase();
  for (const record of records) {
    if (!record.associatedRunway) continue;
    const owner = record.associatedAirport?.toUpperCase();
    if (owner && here && owner !== here) continue;
    map.set(runwayEndKey(record.associatedRunway), record);
  }
  return map;
}

export default function InfoTab() {
  const { t } = useTranslation();
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const isCustom = useAppStore((s) => s.selectedAirportIsCustom);
  const { network } = useNetworkTraffic();
  const networkOn = network !== null;
  const staffing = useMapStore((s) => (icao ? s.atcStaffing[icao.toUpperCase()] : undefined));

  const [showAllFreqs, setShowAllFreqs] = useState(false);
  // Runways and frequencies open on what is in use; the chevrons in each heading show all.
  const [compactRunwayList, setCompactRunwayList] = useState(true);
  const [compactFreqList, setCompactFreqList] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const { data: navData } = useNavDataQuery(
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null,
    50
  );
  const { data: gatewayUpdate } = useGatewayUpdateCheck(icao, isCustom);
  const gatewayInstall = useGatewayInstall();
  const gatewayRemove = useGatewayRemove();
  // A custom pack already covers the airport: the install waits for a yes.
  const [gatewayConflict, setGatewayConflict] = useState<string | null>(null);
  const installFromGateway = async (force: boolean) => {
    if (!icao || !gatewayUpdate) return;
    try {
      await gatewayInstall.mutateAsync({
        icao,
        sceneryId: gatewayUpdate.recommendedPackId,
        force,
      });
      toast.success(t('airportInfo.gateway.installed', { icao }), {
        description: t('airportInfo.gateway.restartHint'),
      });
    } catch (e) {
      if (e instanceof GatewayActionError && e.error.code === 'CONFLICT') {
        setGatewayConflict(e.error.pack);
        return;
      }
      const code = e instanceof GatewayActionError ? e.error.code : 'INSTALL_FAILED';
      toastError(
        'addon_manager',
        { action: 'gateway_install', cause: code },
        t(`airportInfo.gateway.errors.${code}`)
      );
    }
  };
  const removeFromGateway = async () => {
    if (!icao) return;
    try {
      await gatewayRemove.mutateAsync(icao);
      toast.success(t('airportInfo.gateway.removed', { icao }));
    } catch (e) {
      const code = e instanceof GatewayActionError ? e.error.code : 'INSTALL_FAILED';
      toastError(
        'addon_manager',
        { action: 'gateway_remove', cause: code },
        t(`airportInfo.gateway.errors.${code}`)
      );
    }
  };
  // Only what the Scenery tab already scanned this session: the panel never starts a scan.
  const { data: sceneryEntries } = useSceneryList(false);
  const sceneryPack = useMemo(
    () => (isCustom && icao && sceneryEntries ? packForAirport(sceneryEntries, icao) : null),
    [isCustom, icao, sceneryEntries]
  );
  // Area-control facilities over the airport, appended to the FREQUENCIES
  // list. Towers stay out — the airport's own rows already carry them.
  const { data: atcControllers } = useAirportATC(
    icao,
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null
  );
  const overlyingAtc = useMemo(
    () =>
      (atcControllers ?? []).filter(
        (c) => c.role !== 'twr' && c.role !== 'gnd' && c.frequencies.length > 0
      ),
    [atcControllers]
  );

  const metar = vatsimMetarData?.parsed ?? null;
  const rawMetar = vatsimMetarData?.raw ?? null;
  // Online network: the positions at this airport and the traffic filed to or from it.
  const stations = staffing?.stations;
  const atisLetter = staffing?.atisCode ?? null;
  const atcRows = useMemo(() => (stations ? buildAtcRows(stations) : []), [stations]);

  // Hoist optional-chained values so the useMemo deps are plain identifiers —
  // the React Compiler's static analysis can't preserve `[obj?.prop]` form.
  const runways = airport?.runways;
  const ilsList = navData?.ils;
  const gsList = navData?.gs;
  const airportFrequencies = airport?.frequencies;

  // What the ATIS says is in use, kept to the ends this airport has. Read off
  // every broadcast, since some airports run one for arrivals and one for departures.
  const atisUse = useMemo(() => {
    if (!stations || !runways) return null;
    const here = new Set(runways.flatMap((r) => r.ends.map((end) => runwayEndKey(end.name))));
    return airportRunwayUse(stations, (end) => here.has(runwayEndKey(end)));
  }, [stations, runways]);

  // Runways sorted by length, descending
  const sortedRunways = useMemo(() => {
    if (!runways) return [];
    return [...runways].sort(
      (a, b) => runwayLengthFeet(b.ends[0], b.ends[1]) - runwayLengthFeet(a.ends[0], a.ends[1])
    );
  }, [runways]);

  // Map of runway end name → ILS navaid (so we can show an ILS chip per end).
  // The nav query covers 50 NM, so a neighbour's ILS 06 would otherwise land
  // on this airport's runway 06: keep the records that name this airport.
  const ilsByEnd = useMemo(() => byRunwayEnd(ilsList, icao), [ilsList, icao]);

  // Map of runway end name → glide-slope navaid. GS records are separate from
  // ILS/LOC and carry `glidepathAngle`; we join by `associatedRunway` so the
  // ILS detail card can show the GS angle.
  const gsByEnd = useMemo(() => byRunwayEnd(gsList, icao), [gsList, icao]);

  // Active runway resolution: ATIS is authoritative when available, wind
  // alignment is a heuristic fallback used only when no ATIS is published.
  const activeRunway = useMemo<ActiveRunway | null>(() => {
    if (atisUse) {
      return {
        source: 'atis',
        ends: atisUse.all.map(runwayEndKey),
        split: atisUse.split,
        arrivals: atisUse.arrivals.map(runwayEndKey),
        departures: atisUse.departures.map(runwayEndKey),
        arrivalLetter: atisUse.arrivalLetter,
        departureLetter: atisUse.departureLetter,
      };
    }
    const wind = metar?.wind;
    if (wind && wind.degrees !== undefined && wind.speed > 0) {
      const best = findPreferredRunwayEnd(sortedRunways, wind.degrees);
      if (best) {
        return {
          source: 'wind',
          ends: [runwayEndKey(best.endName)],
          windDeg: wind.degrees,
          windSpeed: wind.speed,
          deltaDeg: best.deltaDeg,
        };
      }
    }
    return null;
  }, [atisUse, metar?.wind, sortedRunways]);

  // Frequencies sorted into flight-flow order. apt.dat sometimes lists the
  // same physical channel twice (legacy 25 kHz row + 8.33 kHz row), so we
  // dedupe by (type, frequency) to avoid rendering twin rows where one
  // attaches a live controller and the other appears offline.
  const frequencies = useMemo(() => {
    if (!airportFrequencies) return [];
    const sorted = [...airportFrequencies].sort(
      (a, b) => freqOrderRank(a.type) - freqOrderRank(b.type)
    );
    const seen = new Set<string>();
    return sorted.filter((f) => {
      const key = `${f.type}-${f.frequency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [airportFrequencies]);

  // Merge static apt.dat frequencies with the live rows. Each static row
  // attaches the first matching controller; unmatched live rows (CTR, FSS,
  // extra controllers on the same role) follow. Staffed rows then lead the
  // list, so none of them hides behind "show all".
  const mergedFreqRows = useMemo<MergedFreqRow[]>(
    () => liveRowsFirst(mergeFreqRows(frequencies, atcRows)),
    [frequencies, atcRows]
  );

  // When the airport publishes its own approach, the TRACON row would repeat
  // it; keep only the centres then.
  const facilityRows = useMemo(() => {
    const hasOwnApproach = mergedFreqRows.some((r) => r.label === 'APP' || r.label === 'DEP');
    return hasOwnApproach
      ? overlyingAtc.filter((c) => c.role !== 'tracon' && c.role !== 'app')
      : overlyingAtc;
  }, [mergedFreqRows, overlyingAtc]);
  const endUse = useMemo(() => activeEndUse(activeRunway), [activeRunway]);
  const listedRunways = useMemo(
    () => activeRunwaysFirst(sortedRunways, new Set(endUse.keys())),
    [sortedRunways, endUse]
  );
  const activeRunwayList = useMemo(
    () => compactRunways(listedRunways, new Set(endUse.keys())),
    [listedRunways, endUse]
  );
  const runwaysCompact = activeRunwayList ? compactRunwayList : null;
  const shownRunways = runwaysCompact && activeRunwayList ? activeRunwayList : listedRunways;

  const staffedFreqRows = useMemo(() => compactFreqRows(mergedFreqRows), [mergedFreqRows]);
  const freqsCompact = staffedFreqRows ? compactFreqList : null;
  const visibleMergedRows =
    freqsCompact === null
      ? showAllFreqs
        ? mergedFreqRows
        : mergedFreqRows.slice(0, FREQ_VISIBLE_DEFAULT)
      : freqsCompact && staffedFreqRows
        ? staffedFreqRows
        : mergedFreqRows;

  if (!airport) return null;

  return (
    <div className="space-y-4">
      {/* Gateway: a newer submission than X-Plane ships, or the pack we installed */}
      {gatewayUpdate && (gatewayUpdate.hasUpdate || gatewayUpdate.installedByUs) && (
        <div className="border-primary/15 bg-primary/5 flex items-center gap-3 rounded-lg border p-3">
          <img src={gatewayLogo} alt="" className="h-5 w-auto shrink-0 opacity-50" />
          <div className="min-w-0 flex-1">
            <p className="text-primary truncate text-xs">
              {gatewayUpdate.hasUpdate
                ? t('airportInfo.gateway.updateAvailable')
                : t('airportInfo.gateway.installedFrom', { id: gatewayUpdate.currentPackId })}
            </p>
            {gatewayUpdate.hasUpdate &&
              (gatewayUpdate.artistName || gatewayUpdate.dateApproved) && (
                <p className="text-muted-foreground text-2xs mt-0.5 truncate">
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
          {gatewayUpdate.hasUpdate && (
            <Button
              size="xs"
              className="shrink-0"
              disabled={gatewayInstall.isPending}
              onClick={() => installFromGateway(false)}
            >
              <Download className="h-3.5 w-3.5" />
              {gatewayInstall.isPending
                ? t('airportInfo.gateway.installing')
                : gatewayUpdate.installedByUs
                  ? t('airportInfo.gateway.update')
                  : t('airportInfo.gateway.install')}
            </Button>
          )}
          {gatewayUpdate.installedByUs && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive shrink-0"
              disabled={gatewayRemove.isPending}
              onClick={removeFromGateway}
              tooltip={t('airportInfo.gateway.remove')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => window.appAPI.openExternal(gatewayUpdate.gatewayUrl)}
            tooltip={t('airportInfo.gateway.viewOnGateway')}
          >
            <ExternalLink className="text-primary/60 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <AlertDialog
        open={gatewayConflict !== null}
        onOpenChange={(open) => !open && setGatewayConflict(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('airportInfo.gateway.conflictTitle', { icao })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('airportInfo.gateway.conflictBody', { pack: gatewayConflict ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setGatewayConflict(null);
                void installFromGateway(true);
              }}
            >
              {t('airportInfo.gateway.installAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sceneryPack && (
        <p
          className="text-muted-foreground min-w-0 truncate text-xs"
          title={sceneryPack.winner ?? ''}
        >
          {sceneryPack.count > 1
            ? t('airportInfo.sceneryPackShadowed', {
                pack: sceneryPack.winner ?? '',
                count: sceneryPack.count,
              })
            : t('airportInfo.sceneryPack', { pack: sceneryPack.winner ?? '' })}
        </p>
      )}

      <ConditionsCard metar={metar} activeRunway={activeRunway} atisLetter={atisLetter} />

      {sortedRunways.length > 0 && (
        <RunwaysSection
          runways={shownRunways}
          totalCount={sortedRunways.length}
          compact={runwaysCompact}
          onToggleCompact={() => setCompactRunwayList((v) => !v)}
          ilsByEnd={ilsByEnd}
          gsByEnd={gsByEnd}
          endUse={endUse}
        />
      )}

      {(mergedFreqRows.length > 0 || facilityRows.length > 0) && (
        <FrequenciesSection
          visible={visibleMergedRows}
          totalCount={mergedFreqRows.length}
          showAll={showAllFreqs}
          onToggle={() => setShowAllFreqs((v) => !v)}
          vatsimEnabled={networkOn}
          onlineCount={atcRows.length}
          facilities={facilityRows}
          compact={freqsCompact}
          onToggleCompact={() => setCompactFreqList((v) => !v)}
        />
      )}

      {icao && <ChartsSection key={icao} icao={icao} />}

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

function freqOrderRank(type: FrequencyType): number {
  const idx = FREQ_FLIGHT_ORDER.indexOf(type);
  return idx === -1 ? 999 : idx;
}

// ---------------------------------------------------------------------------
// Helpers — runway / wind alignment
// ---------------------------------------------------------------------------

interface PreferredEnd {
  endName: string;
  deltaDeg: Degrees;
}

/** One live position as the frequency list shows it. */
interface AtcRow {
  id: string;
  role: AtcRole;
  badgeLabel: string;
  badgeVariant: AtcBadgeVariant;
  callsign: string;
  frequency: string;
  summary: string;
  detail?: string;
  /** Letter of the ATIS a non-ATIS position carries, as IVAO controllers do. */
  atisLetter?: string;
}

function buildAtcRows(stations: NetworkStation[]): AtcRow[] {
  return stations.map((s) => ({
    id: `${s.callsign}-${s.frequency}`,
    role: s.role,
    badgeLabel: stationLabel(s),
    badgeVariant: ATC_ROLE_BADGE_VARIANTS[s.role],
    callsign: s.callsign,
    frequency: s.frequency,
    summary: s.name,
    detail: s.atis?.lines.length ? s.atis.lines.join(' | ') : undefined,
    atisLetter: s.role !== 'ATIS' ? (s.atis?.code ?? undefined) : undefined,
  }));
}

/**
 * Map a controller role to the apt.dat frequency type it usually covers.
 * Returns null for roles that don't have an apt.dat counterpart (CTR, FSS,
 * OTHER) — those become "extra" rows appended after the static frequency
 * list.
 */
function facilityRoleToFreqType(role: AtcRole): FrequencyType | null {
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

function mergeFreqRows(staticFreqs: Frequency[], liveRows: AtcRow[]): MergedFreqRow[] {
  const usedVatsimIds = new Set<string>();
  const result: MergedFreqRow[] = [];

  // Pass 1: each static row attaches the first live row whose role matches.
  for (let i = 0; i < staticFreqs.length; i++) {
    const f = staticFreqs[i];
    if (!f) continue;
    const match = liveRows.find(
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
            atisLetter: match.atisLetter,
          }
        : undefined,
    });
  }

  // Pass 2: live rows that didn't match any static row (CTR, FSS, extras).
  for (const r of liveRows) {
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
        atisLetter: r.atisLetter,
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
function findPreferredRunwayEnd(runways: Runway[], windDeg: Degrees): PreferredEnd | null {
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
