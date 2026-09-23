import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight,
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

/** Same shape as the flight strip's data blocks so the summary reads like the rest of the app. */
function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base font-medium tabular-nums">{value}</span>
        {unit && <span className="text-muted-foreground text-xs">{unit}</span>}
      </div>
    </div>
  );
}

function TokenChip({ token, onRemove }: { token: RouteToken; onRemove: () => void }) {
  const { t } = useTranslation();
  const tone =
    token.status === 'ok'
      ? token.kind === 'airway'
        ? 'border-info/40 bg-info/10 text-info'
        : 'border-border bg-card text-foreground'
      : token.status === 'unknown'
        ? 'border-warning/50 bg-warning/10 text-warning'
        : 'border-destructive/50 bg-destructive/10 text-destructive';
  return (
    <span
      className={cn(
        'group inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px]',
        tone,
        token.status !== 'ok' && 'line-through decoration-current/60'
      )}
      title={token.issue ? t(`planBuilder.issues.${token.issue}`) : undefined}
    >
      {token.text}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground -mr-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={t('planBuilder.removeToken', { token: token.text })}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

const NO_PROCEDURES: ResolvedProcedure[] = [];

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
  const skipped = useMemo(
    () => result?.tokens.filter((tk) => tk.status !== 'ok').length ?? 0,
    [result]
  );
  const ready = status === 'ready' && result !== null;
  const hasEndpoints = !!departure && !!arrival;

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Route className="text-primary h-4 w-4" />
            {t('planBuilder.title')}
          </DialogTitle>
          <DialogDescription>{t('planBuilder.description')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          <SettingsSectionBlock title={t('planBuilder.sections.airports')}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <div className="border-border bg-card/60 space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <PlaneTakeoff className="text-muted-foreground h-3.5 w-3.5" />
                  <Label className="text-xs">{t('planBuilder.departure')}</Label>
                </div>
                <AirportPicker
                  airports={airports}
                  value={departure}
                  placeholder={t('planBuilder.pickAirport')}
                  onChange={setDeparture}
                />
                {departure && (
                  <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                    <RunwaySelect
                      icao={departure.icao}
                      value={departure.runway}
                      onChange={(rwy) => setRunway('departure', rwy)}
                    />
                    <ProcedureSelect
                      procedures={sids}
                      runway={departure.runway}
                      value={departure.sid}
                      placeholder={t('planBuilder.sid')}
                      onChange={(choice) => setProcedureChoice('sid', choice)}
                    />
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="mt-9"
                onClick={swapEndpoints}
                aria-label={t('planBuilder.swap')}
                disabled={!departure && !arrival}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>

              <div className="border-border bg-card/60 space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <PlaneLanding className="text-muted-foreground h-3.5 w-3.5" />
                  <Label className="text-xs">{t('planBuilder.arrival')}</Label>
                </div>
                <AirportPicker
                  airports={airports}
                  value={arrival}
                  placeholder={t('planBuilder.pickAirport')}
                  onChange={setArrival}
                />
                {arrival && (
                  <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                    <RunwaySelect
                      icao={arrival.icao}
                      value={arrival.runway}
                      onChange={(rwy) => setRunway('arrival', rwy)}
                    />
                    <ProcedureSelect
                      procedures={stars}
                      runway={arrival.runway}
                      value={arrival.star}
                      placeholder={t('planBuilder.star')}
                      onChange={(choice) => setProcedureChoice('star', choice)}
                    />
                    <div />
                    <ProcedureSelect
                      procedures={approaches}
                      runway={arrival.runway}
                      value={arrival.approach}
                      placeholder={t('planBuilder.approach')}
                      onChange={(choice) => setProcedureChoice('approach', choice)}
                    />
                  </div>
                )}
              </div>
            </div>
          </SettingsSectionBlock>

          <SettingsSectionBlock
            title={t('planBuilder.sections.enroute')}
            description={t('planBuilder.routeHint')}
          >
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Textarea
                  value={routeText}
                  onChange={(e) => setRouteText(e.target.value)}
                  placeholder={t('planBuilder.routePlaceholder')}
                  className="min-h-[60px] flex-1 font-mono text-sm uppercase"
                  spellCheck={false}
                />
                <Button
                  variant="outline"
                  onClick={handleAutoRoute}
                  disabled={!hasEndpoints || autoRouting}
                  className="shrink-0"
                >
                  <Wand2 className={cn('mr-2 h-4 w-4', autoRouting && 'animate-pulse')} />
                  {autoRouting ? t('planBuilder.autoRouting') : t('planBuilder.autoRoute')}
                </Button>
              </div>
              {result && result.tokens.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {result.tokens.map((tk, i) => (
                    <TokenChip
                      key={`${tk.text}-${i}`}
                      token={tk}
                      onRemove={() => removeRouteToken(i)}
                    />
                  ))}
                  {skipped > 0 && (
                    <Badge variant="warning" className="ml-1 text-[10px]">
                      {t('planBuilder.skipped', { count: skipped })}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </SettingsSectionBlock>

          <SettingsSectionBlock title={t('planBuilder.sections.summary')}>
            <div className="border-border bg-card/60 flex flex-wrap items-end gap-6 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('planBuilder.cruise')}</Label>
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
                    className="h-9 w-28 font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={suggestCruise} disabled={!ready}>
                    {t('planBuilder.suggest')}
                  </Button>
                </div>
              </div>
              <Separator orientation="vertical" className="h-10" />
              {!hasEndpoints ? (
                <span className="text-muted-foreground text-sm">
                  {t('planBuilder.pickEndpoints')}
                </span>
              ) : !result ? (
                <span className="text-muted-foreground text-sm">{t('planBuilder.resolving')}</span>
              ) : (
                <div className="flex flex-wrap gap-6">
                  <Stat
                    label={t('planBuilder.distance')}
                    value={String(Math.round(distanceNm))}
                    unit={t('planBuilder.nmUnit')}
                  />
                  {ETE_CLASSES.map((cls) => (
                    <Stat
                      key={cls}
                      label={t(`planBuilder.class.${cls}`)}
                      value={formatMinutes(estimateMinutes(distanceNm, cls))}
                    />
                  ))}
                </div>
              )}
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
