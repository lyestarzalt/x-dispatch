import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Eraser,
  Loader2,
  Map as MapIcon,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Save,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSectionBlock } from '@/components/dialogs/SettingsDialog/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  estimateMinutes,
  isEastbound,
  suggestCruiseAltitudeFt,
} from '@/lib/flightplan/builder/geometry';
import { matchProcedure } from '@/lib/flightplan/builder/procedures';
import type { RouteToken } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useAirportProcedures } from '@/queries';
import { useAirportRunways } from '@/queries/useAirportRunways';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RangeRingCategory } from '@/types/layers';
import type { ResolvedProcedure } from '@/types/navigation';
import type { AircraftCategory } from '@/types/xplane';
import { AirportPicker } from './AirportPicker';
import { ProcedureSelect } from './ProcedureSelect';
import { RunwaySelect } from './RunwaySelect';

const RESOLVE_DEBOUNCE_MS = 400;
const ETE_CLASSES: RangeRingCategory[] = ['jet', 'turboprop', 'prop'];
const NO_PROCEDURES: ResolvedProcedure[] = [];
const FIELD_CLASS = 'h-8 w-full font-mono text-xs';

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

/** Same shape as the flight strip's data blocks so the summary reads like the rest of the app. */
function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <Caption>{label}</Caption>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base font-medium tabular-nums">{value}</span>
        {unit && <span className="text-muted-foreground text-xs">{unit}</span>}
      </div>
    </div>
  );
}

function EndpointCard({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-card/60 space-y-3 rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </div>
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
  const showOnMap = usePlanBuilderStore((s) => s.showOnMap);
  const saveToXPlane = usePlanBuilderStore((s) => s.saveToXPlane);
  const startAtDeparture = usePlanBuilderStore((s) => s.startAtDeparture);
  const aircraftCategory = usePlaneStore((s) => s.state?.aircraftCategory);
  const [saving, setSaving] = useState(false);

  const { data: depProcedures } = useAirportProcedures(isOpen ? (departure?.icao ?? null) : null);
  const { data: arrProcedures } = useAirportProcedures(isOpen ? (arrival?.icao ?? null) : null);
  // The IPC returns procedures already resolved to coordinates despite the narrower type.
  const sids = (depProcedures?.sids as ResolvedProcedure[] | undefined) ?? NO_PROCEDURES;
  const stars = (arrProcedures?.stars as ResolvedProcedure[] | undefined) ?? NO_PROCEDURES;
  const approaches =
    (arrProcedures?.approaches as ResolvedProcedure[] | undefined) ?? NO_PROCEDURES;

  // Resolve a beat after the last edit, and once when the dialog opens with a stored draft.
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

  const suggestCruise = () => {
    if (!departure || !arrival || !result) return;
    const cls = planningClass(aircraftCategory);
    setCruiseAltitude(suggestCruiseAltitudeFt(distanceNm, cls, isEastbound(departure, arrival)));
  };

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
      <span className="text-foreground">
        {t('planBuilder.routeSummary', { fixes: fixCount, airways: airwayCount })}
      </span>
      {problems.length > 0 && (
        <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
          {t('planBuilder.skipped', { count: problems.length })}
        </Badge>
      )}
    </span>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Route className="text-primary h-4 w-4" />
            {t('planBuilder.title')}
            <Badge variant="warning" className="px-1.5 py-0.5 text-[10px] leading-none uppercase">
              {t('toolbar.alphaTag')}
            </Badge>
          </DialogTitle>
          <DialogDescription>{t('planBuilder.description')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[72vh] space-y-6 overflow-y-auto px-6 py-5">
          <SettingsSectionBlock title={t('planBuilder.sections.airports')}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <EndpointCard
                icon={<PlaneTakeoff className="h-3.5 w-3.5" />}
                label={t('planBuilder.departure')}
              >
                <AirportPicker
                  airports={airports}
                  value={departure}
                  placeholder={t('planBuilder.pickAirport')}
                  onChange={setDeparture}
                />
                {departure && (
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
                )}
              </EndpointCard>

              <Button
                variant="ghost"
                size="icon"
                className="mt-10"
                onClick={swapEndpoints}
                aria-label={t('planBuilder.swap')}
                disabled={!departure && !arrival}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>

              <EndpointCard
                icon={<PlaneLanding className="h-3.5 w-3.5" />}
                label={t('planBuilder.arrival')}
              >
                <AirportPicker
                  airports={airports}
                  value={arrival}
                  placeholder={t('planBuilder.pickAirport')}
                  onChange={setArrival}
                />
                {arrival && (
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
                )}
              </EndpointCard>
            </div>
          </SettingsSectionBlock>

          <SettingsSectionBlock
            title={t('planBuilder.sections.enroute')}
            description={t('planBuilder.routeHint')}
          >
            <div className="border-border bg-card/60 space-y-3 rounded-lg border p-3">
              <Textarea
                value={routeText}
                onChange={(e) => setRouteText(e.target.value)}
                placeholder={t('planBuilder.routePlaceholder')}
                className="[field-sizing:content] max-h-36 min-h-[3.25rem] resize-none overflow-y-auto font-mono text-sm leading-6 tracking-wide uppercase"
                spellCheck={false}
              />
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 truncate">{routeStatus}</div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRouteText('')}
                    disabled={routeText.length === 0}
                  >
                    <Eraser className="mr-1.5 h-3.5 w-3.5" />
                    {t('planBuilder.clear')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoRoute}
                    disabled={!hasEndpoints || autoRouting}
                  >
                    {autoRouting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
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
            </div>
          </SettingsSectionBlock>

          <SettingsSectionBlock title={t('planBuilder.sections.summary')}>
            <div className="border-border bg-card/60 grid grid-cols-[auto_1fr] items-end gap-8 rounded-lg border p-3">
              <Field label={t('planBuilder.cruise')}>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step={1000}
                    min={0}
                    max={60000}
                    value={cruiseAltitudeFt ?? ''}
                    onChange={(e) =>
                      setCruiseAltitude(e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="h-8 w-28 font-mono text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={suggestCruise} disabled={!ready}>
                    {t('planBuilder.suggest')}
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap justify-end gap-8">
                <Stat
                  label={t('planBuilder.distance')}
                  value={ready ? String(Math.round(distanceNm)) : '—'}
                  unit={t('planBuilder.nmUnit')}
                />
                {ETE_CLASSES.map((cls) => (
                  <Stat
                    key={cls}
                    label={t(`planBuilder.class.${cls}`)}
                    value={ready ? formatMinutes(estimateMinutes(distanceNm, cls)) : '—'}
                  />
                ))}
              </div>
            </div>
          </SettingsSectionBlock>
        </div>

        <DialogFooter className="border-border items-center gap-2 border-t px-6 py-3 sm:justify-between">
          <div className="min-w-0">
            {savedPath && (
              <Badge variant="success" className="max-w-[24rem] truncate font-mono text-[10px]">
                {savedPath}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startAtDeparture} disabled={!departure}>
              <PlaneTakeoff className="mr-2 h-4 w-4" />
              {t('planBuilder.setStart')}
            </Button>
            <Button variant="outline" onClick={showOnMap} disabled={!ready}>
              <MapIcon className="mr-2 h-4 w-4" />
              {t('planBuilder.showOnMap')}
            </Button>
            <Button onClick={handleSave} disabled={!ready || saving}>
              <Save className="mr-2 h-4 w-4" />
              {t('planBuilder.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
