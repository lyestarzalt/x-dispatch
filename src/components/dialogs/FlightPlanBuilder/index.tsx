import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpDown,
  CheckCircle2,
  CloudSun,
  Dices,
  Eraser,
  type LucideIcon,
  Mountain,
  PlaneLanding,
  PlaneTakeoff,
  RotateCcw,
  Route,
  Save,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnits } from '@/hooks/useUnits';
import { type PlanVisit, planVisitSummary } from '@/lib/analytics/planVisit';
import { formatDuration } from '@/lib/flightRecorder/format';
import { suggestAlternate } from '@/lib/flightplan/builder/alternate';
import {
  cruiseBand,
  describeCruiseIssue,
  fitCruiseToBand,
  planIsEastbound,
  procedureFloorFt,
} from '@/lib/flightplan/builder/cruiseAdjust';
import { formatLevel } from '@/lib/flightplan/builder/formatLevel';
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
import {
  cruiseFitsTrack,
  cruiseOnTracks,
  natCrossing,
  offeredTracks,
  trackInRoute,
} from '@/lib/flightplan/builder/trackChoice';
import type { LevelBand, PlanEndpoint, RouteToken } from '@/lib/flightplan/builder/types';
import { kgToLbs } from '@/lib/utils/format';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { toastError } from '@/lib/utils/toastError';
import type { Airport } from '@/lib/xplaneServices/dataService';
import {
  trackEvent,
  useAirportProcedures,
  useOceanicTracks,
  useTrackFeatureOpened,
} from '@/queries';
import { useAirportRunways } from '@/queries/useAirportRunways';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useMapStore } from '@/stores/mapStore';
import { type ExploreTab, usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RangeRingCategory } from '@/types/layers';
import type { ResolvedProcedure } from '@/types/navigation';
import { AirportPicker, toEndpoint } from './AirportPicker';
import { CruiseStat } from './CruiseStat';
import { EndpointLabel } from './EndpointLabel';
import { Field } from './Field';
import { LightSection } from './LightSection';
import { ProcedureSelect } from './ProcedureSelect';
import { RouteEnd } from './RouteEnd';
import { RouteProblem } from './RouteProblem';
import { RunwaySelect } from './RunwaySelect';
import { Section } from './Section';
import { Stat } from './Stat';
import { TrackPicker } from './TrackPicker';
import { WindHint } from './WindHint';
import { ExploreFlyout } from './explore/ExploreFlyout';

const RESOLVE_DEBOUNCE_MS = 400;
const NO_PROCEDURES: ResolvedProcedure[] = [];
const FIELD_CLASS = 'h-9 w-full font-mono text-sm';
const CLASSES: RangeRingCategory[] = ['jet', 'turboprop', 'prop'];
/** Explore flyout tabs, in header order. */
const EXPLORE_TABS = [
  { id: 'random', icon: Dices },
  { id: 'routes', icon: Route },
  { id: 'weather', icon: CloudSun },
] as const satisfies ReadonlyArray<{ id: ExploreTab; icon: LucideIcon }>;

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
  const restoreDraft = usePlanBuilderStore((s) => s.restoreDraft);
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
  const autoRoutedText = usePlanBuilderStore((s) => s.autoRoutedText);
  const setDeparture = usePlanBuilderStore((s) => s.setDeparture);
  const setArrival = usePlanBuilderStore((s) => s.setArrival);
  const setRunway = usePlanBuilderStore((s) => s.setRunway);
  const setProcedureChoice = usePlanBuilderStore((s) => s.setProcedureChoice);
  const setResolvedProcedures = usePlanBuilderStore((s) => s.setResolvedProcedures);
  const swapEndpoints = usePlanBuilderStore((s) => s.swapEndpoints);
  const setRouteText = usePlanBuilderStore((s) => s.setRouteText);
  const removeRouteToken = usePlanBuilderStore((s) => s.removeRouteToken);
  const setCruiseAltitude = usePlanBuilderStore((s) => s.setCruiseAltitude);
  const adjustCruiseAltitude = usePlanBuilderStore((s) => s.adjustCruiseAltitude);
  const procedures = usePlanBuilderStore((s) => s.procedures);
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
  const explore = usePlanBuilderStore((s) => s.explore);
  const setExplore = usePlanBuilderStore((s) => s.setExplore);

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
  // The router picks airways for the cruise level, so a missing cruise is guessed from the
  // great-circle distance first; routing at the router's own default would favour the lower
  // airways and leave a jet flagged on every one of them.
  // North Atlantic tracks for the crossing, if the pair makes one. The cruise suggested for a
  // crossing lands on a level the tracks offer, so the router can take a track straight away.
  const crossing = departure && arrival ? natCrossing(departure, arrival) : null;
  const { data: natFeed } = useOceanicTracks(isOpen && crossing !== null);
  // The level the app picks: by distance, class and direction, then onto the tracks of a
  // crossing, then inside what an existing route and its procedures allow.
  const suggestCruise = (
    departure: PlanEndpoint,
    arrival: PlanEndpoint,
    distanceNm: number,
    band?: LevelBand
  ) => {
    const eastbound = isEastbound(departure, arrival);
    let suggested = suggestCruiseAltitudeFt(distanceNm, cls, eastbound);
    if (crossing)
      suggested = cruiseOnTracks(suggested, offeredTracks(natFeed, crossing), eastbound);
    if (band) suggested = fitCruiseToBand(suggested, band, eastbound);
    return suggested;
  };

  const autoRoutedPair = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !departure || !arrival || routeText !== '') return;
    if (depLoading || arrLoading) return;
    const pair = `${departure.icao}-${arrival.icao}`;
    if (autoRoutedPair.current === pair) return;
    if (cruiseAltitudeFt === null) {
      // A crossing waits for the track message, like the procedures, so the cruise fits it.
      if (crossing && natFeed === undefined) return;
      setCruiseAltitude(suggestCruise(departure, arrival, greatCircleNm(departure, arrival)));
      return;
    }
    autoRoutedPair.current = pair;
    void autoRoute(joins);
    // suggestCruise is rebuilt every render from values that are all listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    departure,
    arrival,
    routeText,
    cruiseAltitudeFt,
    cls,
    crossing,
    natFeed,
    setCruiseAltitude,
    autoRoute,
    joins,
    depLoading,
    arrLoading,
  ]);

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
  // Airways used as typed but flagged; a partial track is explained by the track picker.
  const checks = useMemo(
    () =>
      tokens
        .map((token, index) => ({ token, index }))
        .filter(({ token }) => token.status === 'warning' && token.issue !== 'trackPartial'),
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

  // Why the cruise is not on a level the airways, procedures and direction allow. Two airways
  // that never share a level are a conflict no cruise can fix, so that banner has no Adjust.
  const cruiseIssue = useMemo(() => {
    if (!ready || !result || !departure || !arrival) return null;
    const band = cruiseBand(result.levels, procedureFloorFt(procedures));
    const eastbound = planIsEastbound(departure, arrival);
    const issue = describeCruiseIssue(cruiseAltitudeFt, band, result.levelSetters, eastbound);
    if (!issue) return null;
    switch (issue.kind) {
      case 'conflict': {
        const ceiling = formatLevel(issue.ceilingFt);
        const floor = formatLevel(issue.floorFt);
        const text =
          issue.low && issue.high
            ? t('planBuilder.cruiseConflict', { low: issue.low, ceiling, high: issue.high, floor })
            : issue.low
              ? t('planBuilder.cruiseConflictProcedure', { low: issue.low, ceiling, floor })
              : t('planBuilder.cruiseConflictPlain', { ceiling, floor });
        return { text, adjustable: false };
      }
      case 'aboveCeiling': {
        const level = formatLevel(issue.ceilingFt);
        return {
          text: issue.airway
            ? t('planBuilder.cruiseAirwayCeiling', { airway: issue.airway, level })
            : t('planBuilder.cruiseAboveCeiling', { level }),
          adjustable: true,
        };
      }
      case 'belowFloor': {
        const level = formatLevel(issue.floorFt);
        return {
          text: issue.airway
            ? t('planBuilder.cruiseAirwayFloor', { airway: issue.airway, level })
            : t('planBuilder.cruiseBelowFloor', { level }),
          adjustable: true,
        };
      }
      case 'parity':
        return {
          text: t(issue.eastbound ? 'planBuilder.cruiseOddLevels' : 'planBuilder.cruiseEvenLevels'),
          adjustable: true,
        };
    }
  }, [ready, result, departure, arrival, cruiseAltitudeFt, procedures, t]);

  // Cruise is picked for the user from distance, aircraft class and direction of flight,
  // inside what the resolved route allows.
  useEffect(() => {
    if (!ready || !result || !departure || !arrival || cruiseAltitudeFt !== null) return;
    if (crossing && natFeed === undefined) return;
    const band = cruiseBand(result.levels, procedureFloorFt(procedures));
    setCruiseAltitude(suggestCruise(departure, arrival, distanceNm, band));
    // suggestCruise is rebuilt every render from values that are all listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    result,
    procedures,
    departure,
    arrival,
    cruiseAltitudeFt,
    distanceNm,
    cls,
    crossing,
    natFeed,
    setCruiseAltitude,
  ]);

  // A new class means a new cruise level, and the airways that suit it; route again once it is set.
  const rerouteAfterCruise = useRef(false);
  useEffect(() => {
    if (!rerouteAfterCruise.current || cruiseAltitudeFt === null || autoRouting) return;
    rerouteAfterCruise.current = false;
    markVisit({ route: 'auto' });
    void autoRoute(joins);
  }, [cruiseAltitudeFt, autoRouting, autoRoute, joins]);

  // A new cruise on a route the router built is routed again for that level, so the plan
  // stays legal without the pilot noticing. A route the pilot typed or edited is theirs: the
  // banner says what it allows and Adjust moves the level instead. The first suggestion
  // (from no cruise) is routed by the pair effect above, and a track pick routes itself.
  const previousCruise = useRef(cruiseAltitudeFt);
  useEffect(() => {
    const previous = previousCruise.current;
    previousCruise.current = cruiseAltitudeFt;
    if (previous === null || cruiseAltitudeFt === null || previous === cruiseAltitudeFt) return;
    if (!isOpen || autoRouting || routeText === '' || routeText !== autoRoutedText) return;
    markVisit({ route: 'auto' });
    void autoRoute(joins, trackInRoute(routeText));
    // Only a cruise change should route again; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cruiseAltitudeFt]);

  const handleAutoRoute = async () => {
    const ok = await autoRoute(joins);
    trackEvent('flight_plan_auto_routed', { success: ok });
    if (ok) markVisit({ route: 'auto' });
    if (!ok) toastError('flight_plan', t('planBuilder.autoRouteFailed'));
  };

  // The chosen track is whatever the route files. Picking a chip or a track on the map routes
  // through it, and takes the cruise along onto a level that track offers.
  const selectedTrack = useMemo(() => trackInRoute(routeText), [routeText]);
  const handlePickTrack = async (track: string | null) => {
    const picked = track
      ? (natFeed?.messages ?? []).flatMap((m) => m.tracks).find((tr) => tr.name === track)
      : undefined;
    if (
      picked &&
      departure &&
      arrival &&
      cruiseAltitudeFt !== null &&
      !cruiseFitsTrack(picked, cruiseAltitudeFt)
    ) {
      setCruiseAltitude(
        cruiseOnTracks(cruiseAltitudeFt, [picked], isEastbound(departure, arrival))
      );
    }
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

  // Starting over and clearing the route are one click, so each offers an undo instead of a prompt.
  const handleNewPlan = () => {
    const previous = reset();
    toast(t('planBuilder.planCleared'), {
      action: { label: t('common.undo'), onClick: () => restoreDraft(previous) },
    });
  };
  const handleClearRoute = () => {
    const previous = routeText;
    setRouteText('');
    toast(t('planBuilder.routeCleared'), {
      action: { label: t('common.undo'), onClick: () => setRouteText(previous) },
    });
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
        <header className="border-border/30 space-y-3 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Route className="text-primary h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">{t('planBuilder.title')}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={handleNewPlan}
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
                tooltip={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RouteEnd endpoint={departure} fallback={t('planBuilder.departure')} />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={swapEndpoints}
              disabled={!departure && !arrival}
              tooltip={t('planBuilder.swap')}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <RouteEnd endpoint={arrival} fallback={t('planBuilder.arrival')} align="right" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Stat
              label={t('planBuilder.distance')}
              value={ready ? units.distance(distanceNm as NauticalMiles) : '—'}
            />
            <Stat
              label={t('planBuilder.ete')}
              value={ready ? formatDuration(estimateMinutes(distanceNm, cls) * 60) : '—'}
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

          {cruiseIssue && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-warning flex min-w-0 items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2" title={cruiseIssue.text}>
                  {cruiseIssue.text}
                </span>
              </span>
              {cruiseIssue.adjustable && (
                <Button
                  variant="outline"
                  size="xs"
                  className="shrink-0"
                  onClick={adjustCruiseAltitude}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {t('planBuilder.adjustCruise')}
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
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

          <ToggleGroup
            type="single"
            size="xs"
            variant="subtle"
            value={explore ?? ''}
            onValueChange={(v) => setExplore(v ? (v as ExploreTab) : null)}
            className="w-full"
          >
            {EXPLORE_TABS.map(({ id, icon: Icon }) => (
              <ToggleGroupItem key={id} value={id} className="min-w-0 flex-1">
                <Icon />
                <span className="truncate">{t(`explore.tabs.${id}`)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            <div className="space-y-3">
              <section className="border-border space-y-3 rounded-lg border p-3">
                <EndpointLabel icon={PlaneTakeoff}>{t('planBuilder.departure')}</EndpointLabel>
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
              </section>

              <section className="border-border space-y-3 rounded-lg border p-3">
                <EndpointLabel icon={PlaneLanding}>{t('planBuilder.arrival')}</EndpointLabel>
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
              </section>
            </div>

            <Section title={t('planBuilder.sections.enroute')}>
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
                    size="xs"
                    onClick={handleClearRoute}
                    disabled={routeText.length === 0}
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    {t('planBuilder.clear')}
                  </Button>
                  <Button
                    variant="default"
                    size="xs"
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
                <div className="space-y-1.5">
                  <span className="xp-label">{t('planBuilder.notUsed')}</span>
                  <ul className="space-y-1">
                    {problems.map(({ token, index }) => (
                      <RouteProblem
                        key={`${token.text}-${index}`}
                        token={token}
                        onRemove={() => removeRouteToken(index)}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {checks.length > 0 && (
                <div className="space-y-1.5">
                  <span className="xp-label">{t('planBuilder.check')}</span>
                  <ul className="space-y-1">
                    {checks.map(({ token, index }) => (
                      <RouteProblem
                        key={`${token.text}-${index}`}
                        token={token}
                        onRemove={() => removeRouteToken(index)}
                      />
                    ))}
                  </ul>
                </div>
              )}
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

        <footer className="border-border/30 space-y-2 border-t px-4 py-3">
          {savedPath && (
            <p className="text-success flex min-w-0 items-center gap-1.5 text-xs" title={savedPath}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">
                {t('planBuilder.savedAs', { file: savedPath.split(/[\\/]/).pop() })}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant={profileStripOpen ? 'secondary' : 'ghost'}
              size="xs"
              className="mr-auto"
              onClick={() => setProfileStripOpen(!profileStripOpen)}
              disabled={!ready}
              aria-pressed={profileStripOpen}
              tooltip={profileStripOpen ? t('profile.hide') : t('profile.show')}
            >
              <Mountain className="h-3.5 w-3.5" />
              {t('planBuilder.profileShort')}
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                startAtDeparture();
                markVisit({ startSet: true });
              }}
              disabled={!departure}
            >
              <PlaneTakeoff className="h-3.5 w-3.5" />
              {t('planBuilder.setStart')}
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!ready || saving}>
              <Save className="h-3.5 w-3.5" />
              {t('planBuilder.save')}
            </Button>
          </div>
        </footer>
      </div>
      {explore && (
        <ExploreFlyout
          airports={airports}
          aircraftClass={cls}
          tab={explore}
          onRandomArrival={(icao) => markVisit({ randomArrival: icao })}
          onClose={() => setExplore(null)}
          className="absolute top-0 bottom-0 left-full ml-2 w-80"
        />
      )}
    </div>
  );
}
