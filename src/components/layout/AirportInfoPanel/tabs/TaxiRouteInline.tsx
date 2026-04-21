import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Pencil, RotateCcw, Route, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { writeFtgRoute } from '@/lib/taxiGraph/ftgExport';
import { useAppStore } from '@/stores/appStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';

export default function TaxiRouteInline() {
  const { t } = useTranslation();

  const icao = useAppStore((s) => s.selectedICAO);
  const airport = useAppStore((s) => s.selectedAirportData);
  const startPosition = useAppStore((s) => s.startPosition);

  const mode = useTaxiRouteStore((s) => s.mode);
  const networkNodeIds = useTaxiRouteStore((s) => s.networkNodeIds);
  const autoRouteResult = useTaxiRouteStore((s) => s.autoRouteResult);
  const selectedRunway = useTaxiRouteStore((s) => s.selectedRunway);
  const graph = useTaxiRouteStore((s) => s.graph);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);

  const setActiveAirport = useTaxiRouteStore((s) => s.setActiveAirport);
  const computeAutoRoute = useTaxiRouteStore((s) => s.computeAutoRoute);
  const clearRoute = useTaxiRouteStore((s) => s.clearRoute);
  const deactivate = useTaxiRouteStore((s) => s.deactivate);
  const setMode = useTaxiRouteStore((s) => s.setMode);
  const removeLastWaypoint = useTaxiRouteStore((s) => s.removeLastWaypoint);
  const removeLastNetworkNode = useTaxiRouteStore((s) => s.removeLastNetworkNode);

  useEffect(() => {
    if (icao) setActiveAirport(icao);
    return () => {
      deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runwayEnds = useMemo(() => {
    if (!airport?.runways) return [];
    const ends: { name: string; lat: number; lon: number }[] = [];
    for (const rwy of airport.runways) {
      for (const end of rwy.ends) {
        ends.push({ name: end.name, lat: end.latitude, lon: end.longitude });
      }
    }
    return ends.sort((a, b) => a.name.localeCompare(b.name));
  }, [airport?.runways]);

  const handleRunwaySelect = (runwayName: string) => {
    if (!startPosition || !graph) return;
    const rwyEnd = runwayEnds.find((r) => r.name === runwayName);
    if (!rwyEnd) return;
    computeAutoRoute(
      startPosition.longitude,
      startPosition.latitude,
      rwyEnd.lon,
      rwyEnd.lat,
      runwayName
    );
  };

  const handleExport = async () => {
    const result = await writeFtgRoute();
    if (!result) return;
    if (result.success) {
      toast.success(
        t('airportInfo.taxiRoute.exportSuccess', 'Route exported for Follow the Greens')
      );
    } else {
      toast.error(result.error ?? t('common.error', 'Error'));
    }
  };

  const isNetwork = mode === 'network';
  const hasRoute = isNetwork ? networkNodeIds.length > 0 : waypoints.length > 0;
  const canExport =
    (isNetwork && networkNodeIds.length >= 2) || (!isNetwork && waypoints.length >= 2);
  const hasGraph = !!graph;
  const isFreehand = mode === 'freehand';

  const routeSummary = useMemo(() => {
    if (!autoRouteResult) return null;
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const name of autoRouteResult.taxiwayNames) {
      if (name && !seen.has(name)) {
        seen.add(name);
        unique.push(name);
      }
    }
    const distance = autoRouteResult.totalDistance;
    const distStr =
      distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
    return { taxiways: unique, distance: distStr };
  }, [autoRouteResult]);

  return (
    <div className="space-y-2 border-t border-border/30 pt-2">
      {/* Taxi to runway */}
      <div className="flex items-center gap-2">
        <span className="xp-label shrink-0">{t('airportInfo.taxiRoute.taxiTo', 'Taxi to')}</span>

        {isFreehand ? (
          <span className="xp-label min-w-0 flex-1 truncate italic">
            {t('airportInfo.taxiRoute.drawManually', 'Draw manually')}
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
                    ? t('airportInfo.taxiRoute.selectRunway', 'Select runway')
                    : t('airportInfo.taxiRoute.noNetwork', 'No taxi data')
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
          onClick={() => (isNetwork ? removeLastNetworkNode() : removeLastWaypoint())}
          disabled={!hasRoute}
          tooltip={t('airportInfo.taxiRoute.undo', 'Undo')}
          className="h-8 w-8 shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        {canExport && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            tooltip={t('airportInfo.taxiRoute.export', 'Export for Follow the Greens')}
            className="h-8 w-8 shrink-0"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Route summary */}
      {routeSummary && (
        <p className="xp-value-primary">
          via {routeSummary.taxiways.join(', ')} · {routeSummary.distance}
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
            {t('airportInfo.taxiRoute.clearAll', 'Clear')}
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
              {t('airportInfo.taxiRoute.autoRoute', 'Auto route')}
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              {t('airportInfo.taxiRoute.drawManually', 'Draw manually')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
