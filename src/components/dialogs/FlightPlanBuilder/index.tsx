import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Map as MapIcon, PlaneTakeoff, Route, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  estimateMinutes,
  isEastbound,
  suggestCruiseAltitudeFt,
} from '@/lib/flightplan/builder/geometry';
import type { RouteToken } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RangeRingCategory } from '@/types/layers';
import type { AircraftCategory } from '@/types/xplane';
import { AirportPicker } from './AirportPicker';
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

function TokenChip({ token }: { token: RouteToken }) {
  const { t } = useTranslation();
  const tone =
    token.status === 'ok'
      ? token.kind === 'airway'
        ? 'border-info/40 text-info'
        : 'border-border text-foreground'
      : token.status === 'unknown'
        ? 'border-warning/60 text-warning line-through'
        : 'border-destructive/60 text-destructive line-through';
  return (
    <span
      className={cn('rounded border px-1.5 py-0.5 font-mono text-[11px]', tone)}
      title={token.issue ? t(`planBuilder.issues.${token.issue}`) : undefined}
    >
      {token.text}
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
  const setDeparture = usePlanBuilderStore((s) => s.setDeparture);
  const setArrival = usePlanBuilderStore((s) => s.setArrival);
  const setRunway = usePlanBuilderStore((s) => s.setRunway);
  const swapEndpoints = usePlanBuilderStore((s) => s.swapEndpoints);
  const setRouteText = usePlanBuilderStore((s) => s.setRouteText);
  const setCruiseAltitude = usePlanBuilderStore((s) => s.setCruiseAltitude);
  const resolve = usePlanBuilderStore((s) => s.resolve);
  const showOnMap = usePlanBuilderStore((s) => s.showOnMap);
  const saveToXPlane = usePlanBuilderStore((s) => s.saveToXPlane);
  const startAtDeparture = usePlanBuilderStore((s) => s.startAtDeparture);
  const aircraftCategory = usePlaneStore((s) => s.state?.aircraftCategory);
  const [saving, setSaving] = useState(false);

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

  const distanceNm = result?.distanceNm ?? 0;
  const skipped = useMemo(
    () => result?.tokens.filter((tk) => tk.status !== 'ok').length ?? 0,
    [result]
  );
  const ready = status === 'ready' && result !== null;

  const suggestCruise = () => {
    if (!departure || !arrival || !result) return;
    const cls = planningClass(aircraftCategory);
    setCruiseAltitude(suggestCruiseAltitudeFt(distanceNm, cls, isEastbound(departure, arrival)));
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            {t('planBuilder.title')}
          </DialogTitle>
          <DialogDescription>{t('planBuilder.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="space-y-1.5">
            <Label>{t('planBuilder.departure')}</Label>
            <AirportPicker
              airports={airports}
              value={departure}
              placeholder={t('planBuilder.pickAirport')}
              onChange={setDeparture}
            />
            <RunwaySelect
              icao={departure?.icao ?? null}
              value={departure?.runway}
              onChange={(rwy) => setRunway('departure', rwy)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mb-11"
            onClick={swapEndpoints}
            aria-label={t('planBuilder.swap')}
            disabled={!departure && !arrival}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <div className="space-y-1.5">
            <Label>{t('planBuilder.arrival')}</Label>
            <AirportPicker
              airports={airports}
              value={arrival}
              placeholder={t('planBuilder.pickAirport')}
              onChange={setArrival}
            />
            <RunwaySelect
              icao={arrival?.icao ?? null}
              value={arrival?.runway}
              onChange={(rwy) => setRunway('arrival', rwy)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('planBuilder.route')}</Label>
          <Textarea
            value={routeText}
            onChange={(e) => setRouteText(e.target.value)}
            placeholder={t('planBuilder.routePlaceholder')}
            className="min-h-[64px] font-mono text-sm uppercase"
            spellCheck={false}
          />
          {result && result.tokens.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {result.tokens.map((tk, i) => (
                <TokenChip key={`${tk.text}-${i}`} token={tk} />
              ))}
              {skipped > 0 && (
                <span className="text-warning ml-1 text-[11px]">
                  {t('planBuilder.skipped', { count: skipped })}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr] items-end gap-4">
          <div className="space-y-1.5">
            <Label>{t('planBuilder.cruise')}</Label>
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
                className="h-9 w-32 font-mono"
              />
              <Button variant="outline" size="sm" onClick={suggestCruise} disabled={!ready}>
                {t('planBuilder.suggest')}
              </Button>
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {!departure || !arrival ? (
              <span>{t('planBuilder.pickEndpoints')}</span>
            ) : status === 'resolving' && !result ? (
              <span>{t('planBuilder.resolving')}</span>
            ) : result ? (
              <>
                <span>
                  {t('planBuilder.distance')}{' '}
                  <span className="text-foreground font-mono">
                    {t('planBuilder.nm', { value: Math.round(distanceNm) })}
                  </span>
                </span>
                {ETE_CLASSES.map((cls) => (
                  <span key={cls}>
                    {t(`planBuilder.class.${cls}`)}{' '}
                    <span className="text-foreground font-mono">
                      {formatMinutes(estimateMinutes(distanceNm, cls))}
                    </span>
                  </span>
                ))}
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            {savedPath && (
              <Badge variant="success" className="max-w-full truncate font-mono text-[10px]">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
