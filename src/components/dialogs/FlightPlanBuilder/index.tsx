import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  CheckCircle2,
  Eraser,
  Loader2,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Save,
  Wand2,
  Wind,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IcaoCode } from '@/components/ui/icao-code';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  estimateMinutes,
  isEastbound,
  suggestCruiseAltitudeFt,
} from '@/lib/flightplan/builder/geometry';
import { matchProcedure } from '@/lib/flightplan/builder/procedures';
import type { RouteToken } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';
import { formatWind } from '@/lib/utils/metar';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useAirportProcedures } from '@/queries';
import { useAirportRunways } from '@/queries/useAirportRunways';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RunwayEnd } from '@/types/fms';
import type { RangeRingCategory } from '@/types/layers';
import type { ResolvedProcedure } from '@/types/navigation';
import type { AircraftCategory } from '@/types/xplane';
import { AirportPicker } from './AirportPicker';
import { ProcedureSelect } from './ProcedureSelect';
import { RunwaySelect } from './RunwaySelect';

const RESOLVE_DEBOUNCE_MS = 400;
const NO_PROCEDURES: ResolvedProcedure[] = [];
const FIELD_CLASS = 'h-8 w-full font-mono text-xs';
/** Wind within this many degrees of a runway heading makes it the suggested one. */
const WIND_SUGGEST_MIN_KT = 4;

function planningClass(category: AircraftCategory | null | undefined): RangeRingCategory {
  switch (category) {
    case 'ga':
    case 'glider':
    case 'ultralight':
    case 'seaplane':
    case 'helicopter':
    case 'vtol':
      return 'prop';
    default:
      return 'jet';
  }
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatLevel(feet: number | null): string {
  if (feet === null) return '—';
  return feet >= 18000 ? `FL${Math.round(feet / 100)}` : `${feet}`;
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground text-[10px] tracking-wider uppercase">{children}</span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Caption>{label}</Caption>
      {children}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <Caption>{label}</Caption>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-muted-foreground text-[10px]">{unit}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <Caption>{title}</Caption>
      {children}
    </section>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-border bg-secondary/40 rounded-xl border p-3 shadow-sm', className)}>
      {children}
    </div>
  );
}

function ProblemChip({ token, onRemove }: { token: RouteToken; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px]',
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
        <X className="h-3 w-3" />
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
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]"
    >
      <Wind className="h-3 w-3" />
      {t('planBuilder.windSuggest', { wind: formatWind(wind, { bare: true }), runway: best.name })}
      <span className="text-primary font-medium">{t('planBuilder.useRunway')}</span>
    </button>
  );
}

interface FlightPlanBuilderProps {
  airports: Airport[];
}

export default function FlightPlanBuilder({ airports }: FlightPlanBuilderProps) {
  const { t } = useTranslation();
  const isOpen = usePlanBuilderStore((s) => s.isOpen);
  const close = usePlanBuilderStore((s) => s.close);
  const departure = usePlanBuilderStore((s) => s.departure);
  const arrival = usePlanBuilderStore((s) => s.arrival);
  const routeText = usePlanBuilderStore((s) => s.routeText);
  const cruiseAltitudeFt = usePlanBuilderStore((s) => s.cruiseAltitudeFt);
  const status = usePlanBuilderStore((s) => s.status);
  const result = usePlanBuilderStore((s) => s.result);
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
  const resolve = usePlanBuilderStore((s) => s.resolve);
  const autoRoute = usePlanBuilderStore((s) => s.autoRoute);
  const saveToXPlane = usePlanBuilderStore((s) => s.saveToXPlane);
  const startAtDeparture = usePlanBuilderStore((s) => s.startAtDeparture);
  const aircraftCategory = usePlaneStore((s) => s.state?.aircraftCategory);
  const showFlightPlanBar = useFlightPlanStore((s) => s.showFlightPlanBar);
  const [saving, setSaving] = useState(false);

  const { data: depProcedures } = useAirportProcedures(isOpen ? (departure?.icao ?? null) : null);
  const { data: arrProcedures } = useAirportProcedures(isOpen ? (arrival?.icao ?? null) : null);
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

  // A new pair of airports with nothing typed gets an airway route straight away, once per pair,
  // so clearing the field on purpose stays cleared.
  const autoRoutedPair = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !departure || !arrival || routeText !== '') return;
    const pair = `${departure.icao}-${arrival.icao}`;
    if (autoRoutedPair.current === pair) return;
    autoRoutedPair.current = pair;
    void autoRoute();
  }, [isOpen, departure, arrival, routeText, autoRoute]);

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
  const problems = useMemo(
    () =>
      tokens.map((token, index) => ({ token, index })).filter(({ token }) => token.status !== 'ok'),
    [tokens]
  );
  const fixCount = tokens.filter((tk) => tk.status === 'ok' && tk.kind !== 'airway').length;
  const airwayCount = tokens.filter((tk) => tk.status === 'ok' && tk.kind === 'airway').length;
  const ready = status === 'ready' && result !== null;
  const hasEndpoints = !!departure && !!arrival;
  const resolving = hasEndpoints && (status === 'resolving' || !result);
  const cls = planningClass(aircraftCategory);

  // Cruise is picked for the user from distance, aircraft class and direction of flight.
  useEffect(() => {
    if (!ready || !departure || !arrival || cruiseAltitudeFt !== null) return;
    setCruiseAltitude(suggestCruiseAltitudeFt(distanceNm, cls, isEastbound(departure, arrival)));
  }, [ready, departure, arrival, cruiseAltitudeFt, distanceNm, cls, setCruiseAltitude]);

  const handleAutoRoute = async () => {
    const ok = await autoRoute();
    if (!ok) toast.error(t('planBuilder.autoRouteFailed'));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const path = await saveToXPlane();
      if (path) toast.success(t('planBuilder.saved', { path }));
    } catch (err) {
      toast.error(t('planBuilder.saveFailed', { error: (err as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const routeStatus = !hasEndpoints ? (
    <span className="text-muted-foreground">{t('planBuilder.pickEndpoints')}</span>
  ) : resolving ? (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t('planBuilder.resolving')}
    </span>
  ) : tokens.length === 0 ? (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      <CheckCircle2 className="text-success h-3.5 w-3.5" />
      {t('planBuilder.directRoute')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      {problems.length > 0 ? (
        <AlertTriangle className="text-warning h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="text-success h-3.5 w-3.5" />
      )}
      <span>{t('planBuilder.routeSummary', { fixes: fixCount, airways: airwayCount })}</span>
      {problems.length > 0 && (
        <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
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
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <Route className="text-primary h-3.5 w-3.5" />
              {t('planBuilder.title')}
              <Badge variant="warning" className="px-1.5 py-0.5 text-[10px] leading-none uppercase">
                {t('toolbar.alphaTag')}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/60 hover:text-foreground h-7 w-7"
              onClick={close}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <IcaoCode className="block text-2xl font-bold">{departure?.icao ?? '----'}</IcaoCode>
              <div className="text-muted-foreground truncate text-[11px]">
                {departure?.name ?? t('planBuilder.departure')}
              </div>
            </div>
            <ArrowRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 text-right">
              <IcaoCode className="block text-2xl font-bold">{arrival?.icao ?? '----'}</IcaoCode>
              <div className="text-muted-foreground truncate text-[11px]">
                {arrival?.name ?? t('planBuilder.arrival')}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-3">
            <Stat
              label={t('planBuilder.distance')}
              value={ready ? String(Math.round(distanceNm)) : '—'}
              unit={t('planBuilder.nmUnit')}
            />
            <Stat
              label={t(`planBuilder.class.${cls}`)}
              value={ready ? formatMinutes(estimateMinutes(distanceNm, cls)) : '—'}
            />
            <Stat label={t('planBuilder.cruiseShort')} value={formatLevel(cruiseAltitudeFt)} />
            <Stat
              label={t('planBuilder.sections.enroute')}
              value={ready ? String(fixCount) : '—'}
              unit={t('planBuilder.fixesUnit')}
            />
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-4 py-4">
            <Section title={t('planBuilder.sections.airports')}>
              <Card className="border-l-success space-y-3 border-l-2">
                <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
                  <span className="bg-success/15 text-success flex h-6 w-6 items-center justify-center rounded-md">
                    <PlaneTakeoff className="h-3.5 w-3.5" />
                  </span>
                  {t('planBuilder.departure')}
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
              </Card>

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 gap-1.5 text-xs"
                  onClick={swapEndpoints}
                  disabled={!departure && !arrival}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  {t('planBuilder.swap')}
                </Button>
              </div>

              <Card className="border-l-warning space-y-3 border-l-2">
                <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
                  <span className="bg-warning/15 text-warning flex h-6 w-6 items-center justify-center rounded-md">
                    <PlaneLanding className="h-3.5 w-3.5" />
                  </span>
                  {t('planBuilder.arrival')}
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
                  </>
                )}
              </Card>
            </Section>

            <Section title={t('planBuilder.sections.enroute')}>
              <Card className="space-y-2.5">
                <Textarea
                  value={routeText}
                  onChange={(e) => setRouteText(e.target.value)}
                  placeholder={t('planBuilder.routePlaceholder')}
                  className="[field-sizing:content] max-h-36 min-h-[3.25rem] resize-none overflow-y-auto font-mono text-xs leading-5 tracking-wide uppercase"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="min-w-0 truncate">{routeStatus}</div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setRouteText('')}
                      disabled={routeText.length === 0}
                    >
                      <Eraser className="mr-1 h-3.5 w-3.5" />
                      {t('planBuilder.clear')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleAutoRoute}
                      disabled={!hasEndpoints || autoRouting}
                    >
                      {autoRouting ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      {autoRouting ? t('planBuilder.autoRouting') : t('planBuilder.autoRoute')}
                    </Button>
                  </div>
                </div>
                {problems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Caption>{t('planBuilder.notUsed')}</Caption>
                    {problems.map(({ token, index }) => (
                      <ProblemChip
                        key={`${token.text}-${index}`}
                        token={token}
                        onRemove={() => removeRouteToken(index)}
                      />
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground text-[11px]">{t('planBuilder.liveHint')}</p>
              </Card>
            </Section>
          </div>
        </ScrollArea>

        <footer className="border-border/30 flex items-center justify-between gap-2 border-t px-4 py-3">
          <div className="min-w-0">
            {savedPath && (
              <Badge variant="success" className="max-w-[12rem] truncate font-mono text-[10px]">
                {savedPath}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startAtDeparture} disabled={!departure}>
              <PlaneTakeoff className="mr-1.5 h-3.5 w-3.5" />
              {t('planBuilder.setStart')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!ready || saving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {t('planBuilder.save')}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
