import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  CheckCircle2,
  Dices,
  Eraser,
  Mountain,
  Pencil,
  PlaneLanding,
  PlaneTakeoff,
  RotateCcw,
  Route,
  Save,
  Wand2,
  Wind,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IcaoCode } from '@/components/ui/icao-code';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnits } from '@/hooks/useUnits';
import { type PlanVisit, planVisitSummary } from '@/lib/analytics/planVisit';
import { suggestAlternate } from '@/lib/flightplan/builder/alternate';
import {
  estimateFuelKg,
  estimateMinutes,
  greatCircleNm,
  isEastbound,
  suggestCruiseAltitudeFt,
} from '@/lib/flightplan/builder/geometry';
import { planningClass } from '@/lib/flightplan/builder/planningClass';
import {
  matchProcedure,
  procedureEntry,
  procedureExit,
  procedureJoins,
  proceduresForRunway,
  suggestProcedures,
} from '@/lib/flightplan/builder/procedures';
import { natCrossing, trackInRoute } from '@/lib/flightplan/builder/trackChoice';
import type { RouteToken } from '@/lib/flightplan/builder/types';
import { kgToLbs } from '@/lib/utils/format';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { formatWind } from '@/lib/utils/metar';
import { toastError } from '@/lib/utils/toastError';
import type { Airport } from '@/lib/xplaneServices/dataService';
import {
  trackEvent,
  useAirportProcedures,
  useOceanicTracks,
  useTrackFeatureOpened,
} from '@/queries';
import { useAirportRunways } from '@/queries/useAirportRunways';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useMapStore } from '@/stores/mapStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RunwayEnd } from '@/types/fms';
import type { RangeRingCategory } from '@/types/layers';
import type { ResolvedProcedure } from '@/types/navigation';
import { AirportPicker, toEndpoint } from './AirportPicker';
import { LightSection } from './LightSection';
import { ProcedureSelect } from './ProcedureSelect';
import { RandomDestinationPanel } from './RandomDestinationPanel';
import { RunwaySelect } from './RunwaySelect';
import { TrackPicker } from './TrackPicker';

const RESOLVE_DEBOUNCE_MS = 400;
const NO_PROCEDURES: ResolvedProcedure[] = [];
const FIELD_CLASS = 'h-9 w-full font-mono text-sm';
const CLASSES: RangeRingCategory[] = ['jet', 'turboprop', 'prop'];
/** Wind within this many degrees of a runway heading makes it the suggested one. */
const WIND_SUGGEST_MIN_KT = 4;

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatLevel(feet: number | null): string {
  if (feet === null) return '—';
  return feet >= 18000 ? `FL${Math.round(feet / 100)}` : `${feet}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <span className="xp-label block truncate">{label}</span>
      {children}
    </div>
  );
}

function StatLabel({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground truncate text-xs">{children}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <StatLabel>{label}</StatLabel>
      <span className="xp-value truncate font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** The cruise figure doubles as its own editor: click, type feet, Enter or blur to apply. */
function CruiseStat({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (feet: number | null) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => {
    const feet = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(feet) && feet >= 0) {
      onChange(Math.round(feet / 100) * 100);
    }
    setEditing(false);
  };
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <StatLabel>{label}</StatLabel>
      {editing ? (
        <Input
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-6 w-20 px-1.5 font-mono text-sm tabular-nums"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value === null ? '' : String(value));
            setEditing(true);
          }}
          title={t('planBuilder.editCruise')}
          className="xp-value hover:text-primary flex items-center gap-1 text-left font-semibold tabular-nums"
        >
          {formatLevel(value)}
          <Pencil className="text-muted-foreground h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="xp-section-heading">{title}</h3>
      {children}
    </section>
  );
}

function PlanCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('bg-secondary/40 p-3', className)}>{children}</Card>;
}

function ProblemChip({ token, onRemove }: { token: RouteToken; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs',
        token.status === 'unknown'
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-destructive/40 bg-destructive/10 text-destructive'
      )}
      title={token.issue ? t(`planBuilder.issues.${token.issue}`) : undefined}
    >
      {token.text}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-foreground -mr-0.5 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label={t('planBuilder.removeToken', { token: token.text })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** The runway end best aligned with the reported wind, when the wind is worth acting on. */
function windRunway(
  ends: RunwayEnd[] | undefined,
  wind: { degrees?: number; speed: number } | undefined
): RunwayEnd | null {
  if (!ends || !wind || wind.degrees === undefined || wind.speed < WIND_SUGGEST_MIN_KT) return null;
  let best: RunwayEnd | null = null;
  let bestDelta = Infinity;
  for (const end of ends) {
    let delta = Math.abs(end.headingDeg - wind.degrees);
    if (delta > 180) delta = 360 - delta;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = end;
    }
  }
  return best;
}

function WindHint({
  icao,
  selected,
  onUse,
}: {
  icao: string;
  selected: string | undefined;
  onUse: (end: RunwayEnd) => void;
}) {
  const { t } = useTranslation();
  const { data: metar } = useVatsimMetarQuery(icao);
  const { data: ends } = useAirportRunways(icao);
  const wind = metar?.parsed.wind;
  const best = useMemo(() => windRunway(ends, wind), [ends, wind]);
  if (!best || best.name === selected) return null;
  return (
    <button
      type="button"
      onClick={() => onUse(best)}
      className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1.5 text-xs"
    >
      <Wind className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {t('planBuilder.windSuggest', {
          wind: formatWind(wind, { bare: true }),
          runway: best.name,
        })}
      </span>
      <span className="text-primary shrink-0 font-medium">{t('planBuilder.useRunway')}</span>
    </button>
  );
}

interface FlightPlanBuilderProps {
  airports: Airport[];
}

export default function FlightPlanBuilder({ airports }: FlightPlanBuilderProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const isOpen = usePlanBuilderStore((s) => s.isOpen);
  useTrackFeatureOpened('flight_plan_builder', isOpen);
  const close = usePlanBuilderStore((s) => s.close);
  const reset = usePlanBuilderStore((s) => s.reset);
  const departure = usePlanBuilderStore((s) => s.departure);
  const arrival = usePlanBuilderStore((s) => s.arrival);
  const routeText = usePlanBuilderStore((s) => s.routeText);
  const cruiseAltitudeFt = usePlanBuilderStore((s) => s.cruiseAltitudeFt);
  const status = usePlanBuilderStore((s) => s.status);
  const result = usePlanBuilderStore((s) => s.result);
  const alternate = usePlanBuilderStore((s) => s.alternate ?? null);
  const setAlternate = usePlanBuilderStore((s) => s.setAlternate);
  const trackRequest = usePlanBuilderStore((s) => s.trackRequest);
  const clearTrackRequest = usePlanBuilderStore((s) => s.clearTrackRequest);
  const savedPath = usePlanBuilderStore((s) => s.savedPath);
  const autoRouting = usePlanBuilderStore((s) => s.autoRouting);
  const setDeparture = usePlanBuilderStore((s) => s.setDeparture);
  const setArrival = usePlanBuilderStore((s) => s.setArrival);
  const setRunway = usePlanBuilderStore((s) => s.setRunway);
  const setProcedureChoice = usePlanBuilderStore((s) => s.setProcedureChoice);
  const setResolvedProcedures = usePlanBuilderStore((s) => s.setResolvedProcedures);
  const swapEndpoints = usePlanBuilderStore((s) => s.swapEndpoints);
  const setRouteText = usePlanBuilderStore((s) => s.setRouteText);
  const removeRouteToken = usePlanBuilderStore((s) => s.removeRouteToken);
  const setCruiseAltitude = usePlanBuilderStore((s) => s.setCruiseAltitude);
  const aircraftClass = usePlanBuilderStore((s) => s.aircraftClass);
  const setAircraftClass = usePlanBuilderStore((s) => s.setAircraftClass);
  const resolve = usePlanBuilderStore((s) => s.resolve);
  const autoRoute = usePlanBuilderStore((s) => s.autoRoute);
  const saveToXPlane = usePlanBuilderStore((s) => s.saveToXPlane);
  const profileStripOpen = useMapStore((s) => s.profileStripOpen);
  const setProfileStripOpen = useMapStore((s) => s.setProfileStripOpen);
  const startAtDeparture = usePlanBuilderStore((s) => s.startAtDeparture);
  const aircraftCategory = usePlaneStore((s) => s.state?.aircraftCategory);
  const showFlightPlanBar = useFlightPlanStore((s) => s.showFlightPlanBar);
  const [saving, setSaving] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);

  // One visit to the planner, reported as flight_plan_closed when it closes.
  const visitRef = useRef<PlanVisit | null>(null);
  const markVisit = (update: Partial<PlanVisit>) => {
    if (visitRef.current) Object.assign(visitRef.current, update);
  };
  useEffect(() => {
    if (isOpen) {
      visitRef.current = {
        openedAt: performance.now(),
        route: usePlanBuilderStore.getState().routeText.trim() ? 'restored' : null,
        randomArrival: null,
        saved: false,
        startSet: false,
      };
      return;
    }
    const visit = visitRef.current;
    visitRef.current = null;
    if (!visit) return;
    const plan = usePlanBuilderStore.getState();
    const planClass =
      plan.aircraftClass ?? planningClass(usePlaneStore.getState().state?.aircraftCategory);
    trackEvent('flight_plan_closed', planVisitSummary(plan, visit, planClass, performance.now()));
  }, [isOpen]);

  const { data: depProcedures, isLoading: depLoading } = useAirportProcedures(
    isOpen ? (departure?.icao ?? null) : null
  );
  const { data: arrProcedures, isLoading: arrLoading } = useAirportProcedures(
    isOpen ? (arrival?.icao ?? null) : null
  );
  // The IPC returns procedures already resolved to coordinates despite the narrower type.
  const sids = (depProcedures?.sids as ResolvedProcedure[] | undefined) ?? NO_PROCEDURES;
  const stars = (arrProcedures?.stars as ResolvedProcedure[] | undefined) ?? NO_PROCEDURES;
  const approaches =
    (arrProcedures?.approaches as ResolvedProcedure[] | undefined) ?? NO_PROCEDURES;

  // Resolve a beat after the last edit, and once when the panel opens with a stored draft.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => void resolve(), RESOLVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    departure?.icao,
    departure?.runway,
    arrival?.icao,
    arrival?.runway,
    routeText,
    cruiseAltitudeFt,
    resolve,
  ]);

  const cls = aircraftClass ?? planningClass(aircraftCategory);

  // Published joins for the router: SID exits and STAR or approach entries for the chosen
  // runways, so it can pick the procedures along with the airways.
  const joins = useMemo(
    () => ({
      exits: procedureJoins(proceduresForRunway(sids, departure?.runway), procedureExit),
      entries: procedureJoins(
        proceduresForRunway(stars.length > 0 ? stars : approaches, arrival?.runway),
        procedureEntry
      ),
    }),
    [sids, stars, approaches, departure?.runway, arrival?.runway]
  );

  // A new pair of airports with nothing typed gets an airway route straight away, once per pair,
  // so clearing the field on purpose stays cleared. Waits for the procedures so joins are known.
  const autoRoutedPair = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !departure || !arrival || routeText !== '') return;
    if (depLoading || arrLoading) return;
    const pair = `${departure.icao}-${arrival.icao}`;
    if (autoRoutedPair.current === pair) return;
    autoRoutedPair.current = pair;
    void autoRoute(joins);
  }, [isOpen, departure, arrival, routeText, autoRoute, joins, depLoading, arrLoading]);

  // An alternate is suggested once per arrival; the user can still pick another.
  useEffect(() => {
    if (!arrival || alternate !== null) return;
    const pick = suggestAlternate(airports, arrival, departure?.icao ?? null, cls);
    if (pick) setAlternate(toEndpoint(pick));
  }, [airports, arrival, alternate, departure?.icao, cls, setAlternate]);

  // A stored draft knows its runway names but not their geometry; fill it in once apt.dat is read.
  const { data: depRunways } = useAirportRunways(isOpen ? (departure?.icao ?? null) : null);
  const { data: arrRunways } = useAirportRunways(isOpen ? (arrival?.icao ?? null) : null);
  useEffect(() => {
    if (departure?.runway && !departure.runwayEnd) {
      const end = depRunways?.find((e) => e.name === departure.runway);
      if (end) setRunway('departure', departure.runway, end);
    }
    if (arrival?.runway && !arrival.runwayEnd) {
      const end = arrRunways?.find((e) => e.name === arrival.runway);
      if (end) setRunway('arrival', arrival.runway, end);
    }
  }, [departure, arrival, depRunways, arrRunways, setRunway]);

  // Pick procedures the way a dispatcher would, once per runway/route combination: the SID that
  // exits where the route starts, the STAR that enters where it ends, and the best approach for
  // the runway. Only empty slots are filled, so a choice (or a deliberate "none") stays put until
  // the runway or the route changes.
  const suggestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || depLoading || arrLoading) return;
    const enroute =
      result?.plan.waypoints.filter((w) => w.via !== 'ADEP' && w.via !== 'ADES') ?? [];
    const firstEnrouteFixId = enroute[0]?.id;
    const lastEnrouteFixId = enroute[enroute.length - 1]?.id;
    const key = [
      departure?.icao,
      departure?.runway,
      arrival?.icao,
      arrival?.runway,
      firstEnrouteFixId,
      lastEnrouteFixId,
    ].join('|');
    if (suggestedFor.current === key) return;
    suggestedFor.current = key;
    const suggestion = suggestProcedures({
      sids,
      stars,
      approaches,
      departureRunway: departure?.runway,
      arrivalRunway: arrival?.runway,
      firstEnrouteFixId,
      lastEnrouteFixId,
      star: matchProcedure(stars, arrival?.star, arrival?.runway),
    });
    if (departure?.runway && !departure.sid && suggestion.sid) {
      setProcedureChoice('sid', suggestion.sid);
    }
    if (arrival?.runway && !arrival.star && suggestion.star) {
      setProcedureChoice('star', suggestion.star);
    }
    if (arrival?.runway && !arrival.approach && suggestion.approach) {
      setProcedureChoice('approach', suggestion.approach);
    }
  }, [
    isOpen,
    depLoading,
    arrLoading,
    result,
    departure,
    arrival,
    sids,
    stars,
    approaches,
    setProcedureChoice,
  ]);

  // Turn the persisted procedure names back into resolved procedures whenever data or choices change.
  useEffect(() => {
    setResolvedProcedures({
      sid: matchProcedure(sids, departure?.sid, departure?.runway),
      star: matchProcedure(stars, arrival?.star, arrival?.runway),
      approach: matchProcedure(approaches, arrival?.approach, arrival?.runway),
    });
  }, [
    sids,
    stars,
    approaches,
    departure?.sid,
    departure?.runway,
    arrival?.star,
    arrival?.approach,
    arrival?.runway,
    setResolvedProcedures,
  ]);

  const distanceNm = result?.distanceNm ?? 0;
  const tokens = useMemo(() => result?.tokens ?? [], [result]);
  // Warnings are used as typed and shown with the track detail, not as skipped tokens.
  const problems = useMemo(
    () =>
      tokens
        .map((token, index) => ({ token, index }))
        .filter(({ token }) => token.status === 'unknown' || token.status === 'invalid'),
    [tokens]
  );
  const routeIssues = useMemo(
    () => tokens.flatMap((tk) => (tk.status === 'warning' && tk.issue ? [tk.issue] : [])),
    [tokens]
  );
  const used = (tk: RouteToken) => tk.status === 'ok' || tk.status === 'warning';
  const fixCount = tokens.filter((tk) => used(tk) && tk.kind !== 'airway').length;
  const airwayCount = tokens.filter((tk) => used(tk) && tk.kind === 'airway').length;
  const ready = status === 'ready' && result !== null;

  // Departure, resolved en-route fixes and arrival, so the light band follows
  // the filed route rather than the great circle between the airports.
  const lightRoutePoints = useMemo(() => {
    if (!departure || !arrival) return [];
    const fixes = (result?.enriched.waypoints ?? []).filter(
      (w) => w.found && Number.isFinite(w.latitude) && Number.isFinite(w.longitude)
    );
    return [departure, ...fixes, arrival].map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }, [departure, arrival, result]);
  const hasEndpoints = !!departure && !!arrival;
  const resolving = hasEndpoints && (status === 'resolving' || !result);

  // Cruise is picked for the user from distance, aircraft class and direction of flight.
  useEffect(() => {
    if (!ready || !departure || !arrival || cruiseAltitudeFt !== null) return;
    setCruiseAltitude(suggestCruiseAltitudeFt(distanceNm, cls, isEastbound(departure, arrival)));
  }, [ready, departure, arrival, cruiseAltitudeFt, distanceNm, cls, setCruiseAltitude]);

  // A new class means a new cruise level, and the airways that suit it; route again once it is set.
  const rerouteAfterCruise = useRef(false);
  useEffect(() => {
    if (!rerouteAfterCruise.current || cruiseAltitudeFt === null || autoRouting) return;
    rerouteAfterCruise.current = false;
    markVisit({ route: 'auto' });
    void autoRoute(joins);
  }, [cruiseAltitudeFt, autoRouting, autoRoute, joins]);

  const handleAutoRoute = async () => {
    const ok = await autoRoute(joins);
    trackEvent('flight_plan_auto_routed', { success: ok });
    if (ok) markVisit({ route: 'auto' });
    if (!ok) toastError('flight_plan', t('planBuilder.autoRouteFailed'));
  };

  // North Atlantic tracks for the crossing, if the pair makes one; the chosen one is whatever
  // the route files. Picking a chip or a track on the map routes through it.
  const crossing = departure && arrival ? natCrossing(departure, arrival) : null;
  const { data: natFeed } = useOceanicTracks(isOpen && crossing !== null);
  const selectedTrack = useMemo(() => trackInRoute(routeText), [routeText]);
  const handlePickTrack = async (track: string | null) => {
    const ok = await autoRoute(joins, track);
    if (!ok) toastError('flight_plan', t('planBuilder.autoRouteFailed'));
  };
  useEffect(() => {
    if (!trackRequest) return;
    clearTrackRequest();
    void handlePickTrack(trackRequest.track);
    // The handler closes over the latest joins; only the request itself should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackRequest, clearTrackRequest]);

  const handleRouteTyped = (text: string) => {
    setRouteText(text);
    markVisit({ route: 'typed' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const path = await saveToXPlane();
      if (path) {
        trackEvent('flight_plan_saved', {});
        markVisit({ saved: true });
        toast.success(t('planBuilder.saved', { path }));
      }
    } catch (err) {
      toastError('flight_plan', t('planBuilder.saveFailed', { error: (err as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const routeStatus = !hasEndpoints ? (
    <span className="text-muted-foreground">{t('planBuilder.pickEndpoints')}</span>
  ) : resolving ? (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      <Spinner className="size-4" />
      {t('planBuilder.resolving')}
    </span>
  ) : tokens.length === 0 ? (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      <CheckCircle2 className="text-success h-4 w-4" />
      {t('planBuilder.directRoute')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      {problems.length > 0 ? (
        <AlertTriangle className="text-warning h-4 w-4" />
      ) : (
        <CheckCircle2 className="text-success h-4 w-4" />
      )}
      <span>{t('planBuilder.routeSummary', { fixes: fixCount, airways: airwayCount })}</span>
      {problems.length > 0 && (
        <Badge variant="warning" className="px-1.5 py-0">
          {t('planBuilder.skipped', { count: problems.length })}
        </Badge>
      )}
    </span>
  );

  return (
    <div
      className={cn(
        'absolute bottom-4 left-4 z-30 w-[26rem] transition-all duration-300 ease-out',
        showFlightPlanBar ? 'top-28' : 'top-16'
      )}
    >
      <div className="border-border/40 bg-card/95 flex h-full flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm">
        <header className="border-border/30 border-b px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Route className="text-primary h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">{t('planBuilder.title')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={
                      randomOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }
                    onClick={() => setRandomOpen((open) => !open)}
                    aria-label={t('planBuilder.randomDestination')}
                    aria-pressed={randomOpen}
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('planBuilder.randomDestination')}</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={reset}
                disabled={!departure && !arrival && !routeText}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('planBuilder.newPlan')}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={close}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <IcaoCode className="block text-2xl font-bold">{departure?.icao ?? '----'}</IcaoCode>
              <div className="text-muted-foreground truncate text-xs">
                {departure?.name ?? t('planBuilder.departure')}
              </div>
            </div>
            <ArrowRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 text-right">
              <IcaoCode className="block text-2xl font-bold">{arrival?.icao ?? '----'}</IcaoCode>
              <div className="text-muted-foreground truncate text-xs">
                {arrival?.name ?? t('planBuilder.arrival')}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-3">
            <Stat
              label={t('planBuilder.distance')}
              value={ready ? units.distance(distanceNm as NauticalMiles) : '—'}
            />
            <Stat
              label={t('planBuilder.ete')}
              value={ready ? formatMinutes(estimateMinutes(distanceNm, cls)) : '—'}
            />
            <CruiseStat
              label={t('planBuilder.cruiseShort')}
              value={cruiseAltitudeFt}
              onChange={setCruiseAltitude}
            />
            <Stat
              label={t('planBuilder.fuel')}
              value={ready ? units.weight(kgToLbs(estimateFuelKg(distanceNm, cls))) : '—'}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="xp-label min-w-0 truncate">{t('planBuilder.aircraft')}</span>
            <ToggleGroup
              type="single"
              size="xs"
              variant="outline"
              value={cls}
              onValueChange={(v) => {
                if (!v) return;
                setAircraftClass(v as RangeRingCategory);
                rerouteAfterCruise.current = true;
              }}
            >
              {CLASSES.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {t(`planBuilder.class.${c}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-4 py-4">
            <Section title={t('planBuilder.sections.airports')}>
              <PlanCard className="border-l-success space-y-3 border-l-2">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="bg-success/15 text-success flex h-7 w-7 shrink-0 items-center justify-center rounded-sm">
                    <PlaneTakeoff className="h-4 w-4" />
                  </span>
                  <span className="truncate">{t('planBuilder.departure')}</span>
                </div>
                <AirportPicker
                  airports={airports}
                  value={departure}
                  placeholder={t('planBuilder.pickAirport')}
                  onChange={setDeparture}
                />
                {departure && (
                  <>
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                      <Field label={t('planBuilder.runway')}>
                        <RunwaySelect
                          icao={departure.icao}
                          value={departure.runway}
                          onChange={(rwy, end) => setRunway('departure', rwy, end)}
                          className={FIELD_CLASS}
                        />
                      </Field>
                      <Field label={t('planBuilder.sid')}>
                        <ProcedureSelect
                          procedures={sids}
                          runway={departure.runway}
                          value={departure.sid}
                          placeholder={t('planBuilder.noProcedure')}
                          onChange={(choice) => setProcedureChoice('sid', choice)}
                          className={FIELD_CLASS}
                        />
                      </Field>
                    </div>
                    <WindHint
                      icao={departure.icao}
                      selected={departure.runway}
                      onUse={(end) => setRunway('departure', end.name, end)}
                    />
                  </>
                )}
              </PlanCard>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={swapEndpoints}
                  disabled={!departure && !arrival}
                >
                  <ArrowDownUp className="h-4 w-4" />
                  {t('planBuilder.swap')}
                </Button>
              </div>

              <PlanCard className="border-l-warning space-y-3 border-l-2">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="bg-warning/15 text-warning flex h-7 w-7 shrink-0 items-center justify-center rounded-sm">
                    <PlaneLanding className="h-4 w-4" />
                  </span>
                  <span className="truncate">{t('planBuilder.arrival')}</span>
                </div>
                <AirportPicker
                  airports={airports}
                  value={arrival}
                  placeholder={t('planBuilder.pickAirport')}
                  onChange={setArrival}
                />
                {arrival && (
                  <>
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,3fr)] gap-2">
                      <Field label={t('planBuilder.runway')}>
                        <RunwaySelect
                          icao={arrival.icao}
                          value={arrival.runway}
                          onChange={(rwy, end) => setRunway('arrival', rwy, end)}
                          className={FIELD_CLASS}
                        />
                      </Field>
                      <Field label={t('planBuilder.star')}>
                        <ProcedureSelect
                          procedures={stars}
                          runway={arrival.runway}
                          value={arrival.star}
                          placeholder={t('planBuilder.noProcedure')}
                          onChange={(choice) => setProcedureChoice('star', choice)}
                          className={FIELD_CLASS}
                        />
                      </Field>
                      <Field label={t('planBuilder.approach')}>
                        <ProcedureSelect
                          procedures={approaches}
                          runway={arrival.runway}
                          value={arrival.approach}
                          placeholder={t('planBuilder.noProcedure')}
                          onChange={(choice) => setProcedureChoice('approach', choice)}
                          className={FIELD_CLASS}
                        />
                      </Field>
                    </div>
                    <WindHint
                      icao={arrival.icao}
                      selected={arrival.runway}
                      onUse={(end) => setRunway('arrival', end.name, end)}
                    />
                    <Field
                      label={
                        alternate
                          ? t('planBuilder.alternateAt', {
                              value: units.distance(
                                greatCircleNm(arrival, alternate) as NauticalMiles
                              ),
                            })
                          : t('planBuilder.alternate')
                      }
                    >
                      <AirportPicker
                        airports={airports}
                        value={alternate}
                        placeholder={t('planBuilder.noAlternate')}
                        onChange={setAlternate}
                      />
                    </Field>
                  </>
                )}
              </PlanCard>
            </Section>

            <Section title={t('planBuilder.sections.enroute')}>
              <PlanCard className="space-y-3">
                <Textarea
                  value={routeText}
                  onChange={(e) => handleRouteTyped(e.target.value)}
                  placeholder={t('planBuilder.routePlaceholder')}
                  className="[field-sizing:content] max-h-36 min-h-[3.25rem] resize-none overflow-y-auto font-mono text-sm leading-6 tracking-wide uppercase"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 truncate">{routeStatus}</div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRouteText('')}
                      disabled={routeText.length === 0}
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      {t('planBuilder.clear')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoRoute}
                      disabled={!hasEndpoints || autoRouting}
                    >
                      {autoRouting ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      {autoRouting ? t('planBuilder.autoRouting') : t('planBuilder.autoRoute')}
                    </Button>
                  </div>
                </div>
                {crossing && natFeed && (
                  <TrackPicker
                    feed={natFeed}
                    direction={crossing}
                    selected={selectedTrack}
                    cruiseAltitudeFt={cruiseAltitudeFt}
                    issues={routeIssues}
                    disabled={autoRouting}
                    onPick={(track) => void handlePickTrack(track)}
                  />
                )}
                {problems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="xp-label">{t('planBuilder.notUsed')}</span>
                    {problems.map(({ token, index }) => (
                      <ProblemChip
                        key={`${token.text}-${index}`}
                        token={token}
                        onRemove={() => removeRouteToken(index)}
                      />
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">{t('planBuilder.liveHint')}</p>
              </PlanCard>
            </Section>

            {isOpen && ready && departure && arrival && (
              <LightSection
                departure={departure}
                arrival={arrival}
                routePoints={lightRoutePoints}
                eteMinutes={estimateMinutes(distanceNm, cls)}
              />
            )}
          </div>
        </ScrollArea>

        <footer className="border-border/30 flex flex-col items-end gap-2 border-t px-4 py-3">
          {savedPath && (
            <Badge
              variant="success"
              className="max-w-full min-w-0 gap-1.5 font-mono"
              title={savedPath}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{savedPath.split(/[\\/]/).pop()}</span>
            </Badge>
          )}
          <div className="flex gap-2">
            <Button
              variant={profileStripOpen ? 'secondary' : 'outline'}
              size="icon-sm"

              onClick={() => setProfileStripOpen(!profileStripOpen)}
              disabled={!ready}
              aria-label={profileStripOpen ? t('profile.hide') : t('profile.show')}
              title={profileStripOpen ? t('profile.hide') : t('profile.show')}
            >
              <Mountain className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startAtDeparture();
                markVisit({ startSet: true });
              }}
              disabled={!departure}
            >
              <PlaneTakeoff className="h-3.5 w-3.5" />
              {t('planBuilder.setStart')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!ready || saving}>
              <Save className="h-3.5 w-3.5" />
              {t('planBuilder.save')}
            </Button>
          </div>
        </footer>
      </div>
      {randomOpen && (
        <RandomDestinationPanel
          airports={airports}
          aircraftClass={cls}
          onAircraftClassChange={(next) => {
            setAircraftClass(next);
            rerouteAfterCruise.current = true;
          }}
          onArrivalPicked={(icao) => markVisit({ randomArrival: icao })}
          onClose={() => setRandomOpen(false)}
          className="absolute top-0 bottom-0 left-full ml-2 w-80"
        />
      )}
    </div>
  );
}
