import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Pencil,
  PlaneLanding,
  PlaneTakeoff,
  RotateCcw,
  Route,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnits } from '@/hooks/useUnits';
import { normalizeWidthCode } from '@/lib/airports/standIdentity';
import { planArrival, planDeparture, routeSummary as summarizeRoute } from '@/lib/taxiGraph';
import { flightPlanTaxiTarget, replansAutoRoute } from '@/lib/taxiGraph/autoPlan';
import { writeFtgRoute } from '@/lib/taxiGraph/ftgExport';
import type { GuidanceSource } from '@/lib/taxiGuidance';
import { metersToNauticalMiles } from '@/lib/utils/geomath';
import { toastError } from '@/lib/utils/toastError';
import { trackEvent } from '@/queries/useAnalytics';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { guidanceRoutes, useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';
import { type TaxiRouteDirection, useTaxiRouteStore } from '@/stores/taxiRouteStore';

export default function TaxiRouteInline() {
  const { t } = useTranslation();
  const units = useUnits();

  const icao = useAppStore((s) => s.selectedICAO);
  const airport = useAppStore((s) => s.selectedAirportData);
  const startPosition = useAppStore((s) => s.startPosition);

  const mode = useTaxiRouteStore((s) => s.mode);
  const direction = useTaxiRouteStore((s) => s.direction);
  const networkNodeIds = useTaxiRouteStore((s) => s.networkNodeIds);
  const selectedRunway = useTaxiRouteStore((s) => s.selectedRunway);
  const graph = useTaxiRouteStore((s) => s.graph);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);

  const setActiveAirport = useTaxiRouteStore((s) => s.setActiveAirport);
  const setAutoRoute = useTaxiRouteStore((s) => s.setAutoRoute);
  const setSizeCode = useTaxiRouteStore((s) => s.setSizeCode);
  const clearRoute = useTaxiRouteStore((s) => s.clearRoute);
  const deactivate = useTaxiRouteStore((s) => s.deactivate);
  const setMode = useTaxiRouteStore((s) => s.setMode);
  const setDirection = useTaxiRouteStore((s) => s.setDirection);
  const restoreRoute = useTaxiRouteStore((s) => s.restoreRoute);
  const removeLastWaypoint = useTaxiRouteStore((s) => s.removeLastWaypoint);
  const undo = useTaxiRouteStore((s) => s.undo);

  useEffect(() => {
    if (icao) setActiveAirport(icao);
    return () => {
      deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hoist optional chain so the useMemo dep is a plain identifier — the
  // React Compiler can't statically preserve `[obj?.prop]` form.
  const runways = airport?.runways;
  const runwayEnds = useMemo(() => {
    if (!runways) return [];
    const ends: { name: string; lat: number; lon: number }[] = [];
    for (const rwy of runways) {
      for (const end of rwy.ends) {
        ends.push({ name: end.name, lat: end.latitude, lon: end.longitude });
      }
    }
    return ends.sort((a, b) => a.name.localeCompare(b.name));
  }, [runways]);

  // The chosen stand's ICAO size stands in for the aircraft's: routes keep to
  // taxiways at least that wide.
  const startupLocations = airport?.startupLocations;
  const sizeCode = useMemo(() => {
    if (startPosition?.type !== 'ramp' || !startupLocations) return null;
    const byIndex = startupLocations[startPosition.index];
    const stand =
      byIndex?.name === startPosition.name
        ? byIndex
        : startupLocations.find((s) => s.name === startPosition.name);
    return normalizeWidthCode(stand?.icaoWidthCode) ?? null;
  }, [startPosition, startupLocations]);
  useEffect(() => setSizeCode(sizeCode), [sizeCode, setSizeCode]);

  // Both directions use `startPosition` (the gate selected in the launcher)
  // as the gate endpoint. Departure routes gate → runway, arrival routes
  // runway → gate. Only the runway is a user pick.
  const handleRunwaySelect = (
    runwayName: string,
    routeDirection: TaxiRouteDirection = direction,
    source: GuidanceSource = 'planned'
  ) => {
    if (!graph || !startPosition || !runways) return;
    const gate = { lat: startPosition.latitude, lon: startPosition.longitude };
    const result =
      routeDirection === 'departure'
        ? planDeparture(graph, runways, gate, runwayName, sizeCode)
        : planArrival(graph, runways, runwayName, gate, sizeCode);
    if (result) setAutoRoute(result, runwayName, source);
    else trackEvent('taxi_route_auto_failed', {});
  };

  // The flight plan's airports and runways (SimBrief or our planner), as plain values so a
  // plan imported or changed while this gate is open re-runs the effect below.
  const planDepartureIcao = useFlightPlanStore((s) => s.departure?.icao);
  const planDepartureRunway = useFlightPlanStore((s) => s.departure?.runway);
  const planArrivalIcao = useFlightPlanStore((s) => s.arrival?.icao);
  const planArrivalRunway = useFlightPlanStore((s) => s.arrival?.runway);

  // With no route yet, reopen the one kept for guidance from this gate. Then take an AUTO
  // route to the flight plan's runway when this is its departure or arrival airport: into
  // an empty planner, or over an AUTO route to another runway; never over the pilot's own.
  // Keyed on the planner's content rather than a once-flag, so a remount (which resets
  // the planner) restores the route too.
  useEffect(() => {
    if (!graph || !startPosition || !icao) return;
    const here = icao.toUpperCase();
    const hasRoute = () => {
      const s = useTaxiRouteStore.getState();
      return s.networkNodeIds.length > 0 || s.waypoints.length > 0;
    };

    if (!hasRoute()) {
      const kept = guidanceRoutes(useTaxiGuidanceStore.getState()).find(
        (r) => r.icao === here && r.gateName === startPosition.name
      );
      if (kept) restoreRoute(kept);
    }

    const { departure, arrival } = useFlightPlanStore.getState();
    const target = flightPlanTaxiTarget(
      here,
      departure,
      arrival,
      runwayEnds.map((r) => r.name)
    );
    if (!target) return;
    const planner = useTaxiRouteStore.getState();
    const replan = replansAutoRoute(
      {
        hasRoute: hasRoute(),
        source: planner.source,
        direction: planner.direction,
        runway: planner.selectedRunway,
      },
      target
    );
    if (!replan) return;
    setDirection(target.direction);
    handleRunwaySelect(target.runway, target.direction, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graph,
    startPosition,
    icao,
    planDepartureIcao,
    planDepartureRunway,
    planArrivalIcao,
    planArrivalRunway,
  ]);

  const handleExport = async () => {
    const result = await writeFtgRoute();
    if (!result) return;
    if (result.success) {
      trackEvent('taxi_route_exported', {});
      toast.success(t('airportInfo.taxiRoute.exportSuccess'));
    } else {
      toastError('taxi_route', result.error ?? t('common.error'));
    }
  };

  const isNetwork = mode === 'network';
  const hasRoute = isNetwork ? networkNodeIds.length > 0 : waypoints.length > 0;
  const canExport =
    (isNetwork && networkNodeIds.length >= 2) || (!isNetwork && waypoints.length >= 2);
  const hasGraph = !!graph;
  const isFreehand = mode === 'freehand';

  // Read from the route as it stands, so drags, via-points and undo update it at once.
  const routeLine = useMemo(() => {
    const summary = isNetwork ? summarizeRoute(graph, networkNodeIds) : null;
    if (!summary || summary.taxiways.length === 0) return null;
    return {
      taxiways: summary.taxiways,
      distance: units.distance(metersToNauticalMiles(summary.meters)),
    };
  }, [isNetwork, graph, networkNodeIds, units]);

  const isArrival = direction === 'arrival';

  return (
    <div className="border-border/30 space-y-2 border-t pt-2">
      {/* Direction toggle — only meaningful in network mode. */}
      {isNetwork && (
        <ToggleGroup
          type="single"
          variant="subtle"
          size="sm"
          value={direction}
          onValueChange={(v) => {
            // ToggleGroup yields '' when the user clicks the active item;
            // ignore that to keep one direction always selected.
            if (v === 'departure' || v === 'arrival') setDirection(v);
          }}
          className="grid grid-cols-2 gap-1"
        >
          <ToggleGroupItem
            value="departure"
            aria-label={t('airportInfo.taxiRoute.departure')}
            className="w-full text-xs"
          >
            <PlaneTakeoff className="h-3.5 w-3.5" />
            {t('airportInfo.taxiRoute.departure')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="arrival"
            aria-label={t('airportInfo.taxiRoute.arrival')}
            className="w-full text-xs"
          >
            <PlaneLanding className="h-3.5 w-3.5" />
            {t('airportInfo.taxiRoute.arrival')}
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      {/* Runway picker — destination on departure, source on arrival */}
      <div className="flex items-center gap-2">
        <span className="xp-label shrink-0">
          {isArrival && !isFreehand
            ? t('airportInfo.taxiRoute.taxiFrom')
            : t('airportInfo.taxiRoute.taxiTo')}
        </span>

        {isFreehand ? (
          <span className="xp-label min-w-0 flex-1 truncate italic">
            {t('airportInfo.taxiRoute.drawManually')}
          </span>
        ) : (
          <Select
            value={selectedRunway ?? ''}
            onValueChange={(v) => {
              if (v) handleRunwaySelect(v);
            }}
            disabled={!hasGraph || runwayEnds.length === 0}
          >
            <SelectTrigger className="h-8 min-w-0 flex-1 font-mono text-sm">
              <SelectValue
                placeholder={
                  hasGraph
                    ? t('airportInfo.taxiRoute.selectRunway')
                    : t('airportInfo.taxiRoute.noNetwork')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {runwayEnds.map((r) => (
                <SelectItem key={r.name} value={r.name} className="font-mono text-sm">
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (isNetwork ? undo() : removeLastWaypoint())}
          disabled={!hasRoute}
          tooltip={t('airportInfo.taxiRoute.undo')}
          className="h-8 w-8 shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        {canExport && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            tooltip={t('airportInfo.taxiRoute.export')}
            className="h-8 w-8 shrink-0"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Route summary */}
      {routeLine && (
        <p className="xp-value-primary">
          {t('airportInfo.taxiRoute.summary', {
            taxiways: routeLine.taxiways.join(', '),
            distance: routeLine.distance,
          })}
        </p>
      )}
      {isFreehand && waypoints.length > 0 && (
        <p className="xp-value truncate">
          {t('airportInfo.taxiRoute.pointsPlaced', {
            count: waypoints.length,
            defaultValue: '{{count}} point(s)',
          })}
        </p>
      )}

      {/* Footer: clear + mode switch */}
      <div className="flex items-center justify-between">
        {hasRoute ? (
          <Button variant="ghost" size="sm" onClick={clearRoute} className="h-7 gap-1 px-2 text-sm">
            <Trash2 className="h-3.5 w-3.5" />
            {t('airportInfo.taxiRoute.clearAll')}
          </Button>
        ) : (
          <span />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode(isFreehand ? 'network' : 'freehand')}
          className="h-7 gap-1 px-2 text-sm"
        >
          {isFreehand ? (
            <>
              <Route className="h-3.5 w-3.5" />
              {t('airportInfo.taxiRoute.autoRoute')}
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              {t('airportInfo.taxiRoute.drawManually')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
