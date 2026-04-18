import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Pencil, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { buildFtgPayload } from '@/lib/taxiGraph/ftgExport';
import { useAppStore } from '@/stores/appStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';

/**
 * Inline taxi route panel — select a runway to auto-route from the gate.
 *
 * Primary flow: gate is already selected → pick runway → A* path draws instantly.
 * Secondary: click "freehand" to draw manually.
 */
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

  // Activate taxi mode on mount
  useEffect(() => {
    if (icao) setActiveAirport(icao);
    return () => {
      deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collect runway ends for dropdown
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
    if (!icao || networkNodeIds.length < 2) return;
    const payload = buildFtgPayload({
      icao,
      mode: 'departure',
      startName: startPosition?.name ?? String(networkNodeIds[0]),
      destName: selectedRunway ?? String(networkNodeIds[networkNodeIds.length - 1]),
      nodeIds: networkNodeIds,
      taxiwayNames: autoRouteResult?.taxiwayNames ?? [],
      distanceM: autoRouteResult?.totalDistance ?? 0,
      gateHeading: startPosition?.heading ?? 0,
      aptDatPath: airport?.sourceFile ?? '',
    });
    const result = await window.xplaneAPI.writeTaxiRoute(JSON.stringify(payload, null, 2));
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
  const canExport = isNetwork && networkNodeIds.length >= 2;
  const hasGraph = !!graph;

  // Deduplicate taxiway names for route summary
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

  const isFreehand = mode === 'freehand';

  return (
    <div className="mt-1.5 space-y-1.5 rounded-md border border-cat-emerald/20 bg-cat-emerald/5 px-2 py-2">
      {/* Main row: gate → runway dropdown → actions */}
      <div className="flex items-center gap-1.5">
        {/* Gate name */}
        <span className="shrink-0 font-mono text-xs text-cat-emerald">
          {startPosition?.name ?? '—'}
        </span>

        <span className="text-xs text-muted-foreground/50">→</span>

        {/* Runway dropdown or freehand label */}
        {isFreehand ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/60">
            {t('airportInfo.taxiRoute.freehandMode', 'Freehand')}
          </span>
        ) : (
          <select
            value={selectedRunway ?? ''}
            onChange={(e) => handleRunwaySelect(e.target.value)}
            disabled={!hasGraph || runwayEnds.length === 0}
            className="min-w-0 flex-1 rounded border border-border/50 bg-transparent px-1.5 py-0.5 font-mono text-xs text-foreground focus:border-cat-emerald focus:outline-none disabled:opacity-40"
          >
            <option value="" disabled>
              {hasGraph
                ? t('airportInfo.taxiRoute.selectRunway', 'Select runway')
                : t('airportInfo.taxiRoute.noNetwork', 'No taxi network')}
            </option>
            {runwayEnds.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        )}

        {/* Action buttons */}
        <div className="flex shrink-0 gap-0.5">
          {/* Undo */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (isNetwork ? removeLastNetworkNode() : removeLastWaypoint())}
            disabled={!hasRoute}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('airportInfo.taxiRoute.undo', 'Undo')}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          {/* FTG Export */}
          {canExport && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              className="h-6 w-6 text-muted-foreground/60 hover:text-cat-emerald"
              title={t('airportInfo.taxiRoute.export', 'Export for Follow the Greens')}
            >
              <Download className="h-3 w-3" />
            </Button>
          )}

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={deactivate}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('common.close', 'Close')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Route summary */}
      {routeSummary && (
        <p className="text-[10px] text-cat-emerald/60">
          via {routeSummary.taxiways.join(', ')} · {routeSummary.distance}
        </p>
      )}

      {/* Freehand info */}
      {isFreehand && waypoints.length > 0 && (
        <p className="text-[10px] text-cat-emerald/60">
          {t('airportInfo.taxiRoute.pointsPlaced', {
            count: waypoints.length,
            defaultValue: '{{count}} point(s) placed — click to add more',
          })}
        </p>
      )}

      {/* Mode toggle footer */}
      <div className="flex items-center justify-between">
        {hasRoute && (
          <button
            onClick={clearRoute}
            className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
          >
            {t('airportInfo.taxiRoute.clearAll', 'Clear')}
          </button>
        )}
        <button
          onClick={() => setMode(isFreehand ? 'network' : 'freehand')}
          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
        >
          {isFreehand ? (
            t('airportInfo.taxiRoute.switchNetwork', 'Network snap')
          ) : (
            <>
              <Pencil className="h-2.5 w-2.5" />
              {t('airportInfo.taxiRoute.switchFreehand', 'Freehand')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
