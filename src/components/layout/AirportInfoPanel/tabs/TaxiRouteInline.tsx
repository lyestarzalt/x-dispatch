import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircleDot,
  Download,
  Eraser,
  MousePointerClick,
  Pencil,
  RotateCcw,
  Route,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { buildFtgPayload } from '@/lib/taxiGraph/ftgExport';
import { useAppStore } from '@/stores/appStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';

export default function TaxiRouteInline() {
  const { t } = useTranslation();

  const icao = useAppStore((s) => s.selectedICAO);
  const mode = useTaxiRouteStore((s) => s.mode);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);
  const networkNodeIds = useTaxiRouteStore((s) => s.networkNodeIds);
  const clickedNodeIds = useTaxiRouteStore((s) => s.clickedNodeIds);
  const clickModeEnabled = useTaxiRouteStore((s) => s.clickModeEnabled);
  const graph = useTaxiRouteStore((s) => s.graph);
  const removeLastWaypoint = useTaxiRouteStore((s) => s.removeLastWaypoint);
  const removeLastNetworkNode = useTaxiRouteStore((s) => s.removeLastNetworkNode);
  const clearRoute = useTaxiRouteStore((s) => s.clearRoute);
  const deactivate = useTaxiRouteStore((s) => s.deactivate);
  const setActiveAirport = useTaxiRouteStore((s) => s.setActiveAirport);
  const setClickModeEnabled = useTaxiRouteStore((s) => s.setClickModeEnabled);
  const setMode = useTaxiRouteStore((s) => s.setMode);

  useEffect(() => {
    if (icao) setActiveAirport(icao);
    return () => {
      deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isNetwork = mode === 'network';
  const hasRoute = isNetwork ? networkNodeIds.length > 0 : waypoints.length > 0;
  const canUndo = isNetwork ? clickedNodeIds.length > 0 : waypoints.length > 0;
  const canExport = isNetwork && networkNodeIds.length >= 2;
  const pointCount = isNetwork ? clickedNodeIds.length : waypoints.length;

  const handleUndo = () => {
    if (isNetwork) removeLastNetworkNode();
    else removeLastWaypoint();
  };

  const handleExport = async () => {
    if (!icao || networkNodeIds.length < 2) return;

    const payload = buildFtgPayload(
      icao,
      'departure',
      String(networkNodeIds[0]),
      String(networkNodeIds[networkNodeIds.length - 1]),
      networkNodeIds,
      ''
    );

    const result = await window.xplaneAPI.writeTaxiRoute(JSON.stringify(payload, null, 2));
    if (result.success) {
      toast.success(
        t('airportInfo.taxiRoute.exportSuccess', 'Route exported for Follow the Greens')
      );
    } else {
      toast.error(result.error ?? t('common.error', 'Error'));
    }
  };

  return (
    <div className="mt-1.5 space-y-1.5 rounded-md border border-cat-emerald/20 bg-cat-emerald/5 px-2 py-2">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5 text-cat-emerald/80">
          <CircleDot className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs font-medium">
            {t('airportInfo.taxiRoute.label', 'Taxi Route')}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode(isNetwork ? 'freehand' : 'network')}
            className={`h-6 w-6 ${isNetwork ? 'text-cat-emerald' : 'text-muted-foreground/60 hover:text-foreground'}`}
            title={
              isNetwork
                ? t('airportInfo.taxiRoute.switchFreehand', 'Switch to freehand')
                : t('airportInfo.taxiRoute.switchNetwork', 'Switch to network snap')
            }
            disabled={!graph && !isNetwork}
          >
            {isNetwork ? <Route className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={!canUndo}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('airportInfo.taxiRoute.undo', 'Undo last point')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearRoute}
            disabled={!hasRoute}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('airportInfo.taxiRoute.clearAll', 'Clear all')}
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setClickModeEnabled(!clickModeEnabled)}
            className={`h-6 w-6 ${clickModeEnabled ? 'text-cat-emerald' : 'text-muted-foreground/60 hover:text-foreground'}`}
            title={
              clickModeEnabled
                ? t('airportInfo.taxiRoute.disableClick', 'Disable click-to-add')
                : t('airportInfo.taxiRoute.enableClick', 'Enable click-to-add')
            }
          >
            <MousePointerClick className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            disabled={!canExport}
            className="h-6 w-6 text-muted-foreground/60 hover:text-cat-emerald"
            title={t('airportInfo.taxiRoute.export', 'Export for Follow the Greens')}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={deactivate}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('common.close', 'Close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {clickModeEnabled && pointCount === 0 ? (
        <p className="text-[10px] text-muted-foreground/50">
          {isNetwork
            ? t(
                'airportInfo.taxiRoute.clickInstructionNetwork',
                'Click on the map — snaps to nearest taxiway node'
              )
            : t(
                'airportInfo.taxiRoute.clickInstruction',
                'Click on the map to add taxi route points'
              )}
        </p>
      ) : clickModeEnabled && pointCount > 0 ? (
        <p className="text-[10px] text-cat-emerald/60">
          {isNetwork
            ? t('airportInfo.taxiRoute.nodesPlaced', {
                count: pointCount,
                defaultValue: '{{count}} node(s) — click to extend route',
              })
            : t('airportInfo.taxiRoute.pointsPlaced', {
                count: pointCount,
                defaultValue: '{{count}} point(s) placed — click to add more',
              })}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground/50">
          {t('airportInfo.taxiRoute.enableHint', 'Enable click-to-add to place route points')}
        </p>
      )}
    </div>
  );
}
