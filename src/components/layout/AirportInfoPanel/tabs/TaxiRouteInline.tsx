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
import { writeFtgRoute } from '@/lib/taxiGraph/ftgExport';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';

export default function TaxiRouteInline() {
  const { t } = useTranslation();

  const icao = useAppStore((s) => s.selectedICAO);
  const airport = useAppStore((s) => s.selectedAirportData);
  const startPosition = useAppStore((s) => s.startPosition);

  const mode = useTaxiRouteStore((s) => s.mode);
  const direction = useTaxiRouteStore((s) => s.direction);
  const networkNodeIds = useTaxiRouteStore((s) => s.networkNodeIds);
  const autoRouteResult = useTaxiRouteStore((s) => s.autoRouteResult);
  const selectedRunway = useTaxiRouteStore((s) => s.selectedRunway);
  const selectedGateName = useTaxiRouteStore((s) => s.selectedGateName);
  const graph = useTaxiRouteStore((s) => s.graph);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);

  const setActiveAirport = useTaxiRouteStore((s) => s.setActiveAirport);
  const computeAutoRoute = useTaxiRouteStore((s) => s.computeAutoRoute);
  const clearRoute = useTaxiRouteStore((s) => s.clearRoute);
  const deactivate = useTaxiRouteStore((s) => s.deactivate);
  const setMode = useTaxiRouteStore((s) => s.setMode);
  const setDirection = useTaxiRouteStore((s) => s.setDirection);
  const setSelectedRunway = useTaxiRouteStore((s) => s.setSelectedRunway);
  const setSelectedGateName = useTaxiRouteStore((s) => s.setSelectedGateName);
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

  const gates = useMemo(() => {
    if (!airport?.startupLocations) return [];
    return [...airport.startupLocations]
      .map((s) => ({ name: s.name, lat: s.latitude, lon: s.longitude }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [airport?.startupLocations]);

  // Departure: gate (startPosition) → runway. Source is the user's spawn
  // gate (set in the launcher); they only pick the destination runway.
  // Arrival: runway → gate. Both endpoints are dropdown picks; the route
  // fires once both are set. Selections persist in the store via the
  // lightweight setters so the user can pick in either order.
  const handleRunwaySelect = (runwayName: string) => {
    if (!graph) return;
    const rwyEnd = runwayEnds.find((r) => r.name === runwayName);
    if (!rwyEnd) return;

    if (direction === 'departure') {
      if (!startPosition) return;
      computeAutoRoute(
        startPosition.longitude,
        startPosition.latitude,
        rwyEnd.lon,
        rwyEnd.lat,
        runwayName
      );
      return;
    }

    setSelectedRunway(runwayName);
    if (!selectedGateName) return;
    const gate = gates.find((g) => g.name === selectedGateName);
    if (!gate) return;
    computeAutoRoute(rwyEnd.lon, rwyEnd.lat, gate.lon, gate.lat, runwayName, gate.name);
  };

  const handleGateSelect = (gateName: string) => {
    if (!graph || direction !== 'arrival') return;
    const gate = gates.find((g) => g.name === gateName);
    if (!gate) return;

    setSelectedGateName(gateName);
    if (!selectedRunway) return;
    const rwyEnd = runwayEnds.find((r) => r.name === selectedRunway);
    if (!rwyEnd) return;
    computeAutoRoute(rwyEnd.lon, rwyEnd.lat, gate.lon, gate.lat, selectedRunway, gate.name);
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

  const isArrival = direction === 'arrival';

  return (
    <div className="space-y-2 border-t border-border/30 pt-2">
      {/* Direction toggle — only meaningful in network mode. */}
      {isNetwork && (
        <div className="flex items-center gap-1">
          <DirectionButton
            active={!isArrival}
            onClick={() => setDirection('departure')}
            icon={<PlaneTakeoff className="h-3.5 w-3.5" />}
            label={t('airportInfo.taxiRoute.departure', 'Departure')}
          />
          <DirectionButton
            active={isArrival}
            onClick={() => setDirection('arrival')}
            icon={<PlaneLanding className="h-3.5 w-3.5" />}
            label={t('airportInfo.taxiRoute.arrival', 'Arrival')}
          />
        </div>
      )}

      {/* Endpoint pickers */}
      <div className="flex items-center gap-2">
        <span className="xp-label shrink-0">
          {isFreehand
            ? t('airportInfo.taxiRoute.taxiTo', 'Taxi to')
            : isArrival
              ? t('airportInfo.taxiRoute.from', 'From')
              : t('airportInfo.taxiRoute.taxiTo', 'Taxi to')}
        </span>

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

      {/* Arrival mode: gate destination picker */}
      {isNetwork && isArrival && (
        <div className="flex items-center gap-2">
          <span className="xp-label shrink-0">{t('airportInfo.taxiRoute.to', 'To')}</span>
          <Select
            value={selectedGateName ?? ''}
            onValueChange={(v) => {
              if (v) handleGateSelect(v);
            }}
            disabled={!hasGraph || gates.length === 0}
          >
            <SelectTrigger className="h-8 min-w-0 flex-1 font-mono text-sm">
              <SelectValue
                placeholder={
                  gates.length === 0
                    ? t('airportInfo.taxiRoute.noGates', 'No gate data')
                    : t('airportInfo.taxiRoute.selectGate', 'Select gate')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {gates.map((g) => (
                <SelectItem key={g.name} value={g.name} className="font-mono text-sm">
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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

function DirectionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className={cn(
        'h-7 flex-1 gap-1 px-2 text-xs',
        active && 'ring-1 ring-primary ring-offset-1 ring-offset-background'
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
