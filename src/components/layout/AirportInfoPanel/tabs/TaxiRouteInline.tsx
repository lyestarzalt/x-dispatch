import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDot, Eraser, MousePointerClick, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';

/**
 * Inline taxi route panel — click-to-add waypoints on the map.
 *
 * Shows the list of placed waypoints, undo/clear buttons,
 * and instructions for the user.
 */
export default function TaxiRouteInline() {
  const { t } = useTranslation();

  const icao = useAppStore((s) => s.selectedICAO);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);
  const clickModeEnabled = useTaxiRouteStore((s) => s.clickModeEnabled);
  const removeLastWaypoint = useTaxiRouteStore((s) => s.removeLastWaypoint);
  const clearRoute = useTaxiRouteStore((s) => s.clearRoute);
  const deactivate = useTaxiRouteStore((s) => s.deactivate);
  const setActiveAirport = useTaxiRouteStore((s) => s.setActiveAirport);
  const setClickModeEnabled = useTaxiRouteStore((s) => s.setClickModeEnabled);

  // Activate taxi mode for this airport on mount, deactivate on unmount
  useEffect(() => {
    if (icao) setActiveAirport(icao);
    return () => {
      deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-1.5 space-y-1.5 rounded-md border border-cat-emerald/20 bg-cat-emerald/5 px-2 py-2">
      {/* Header */}
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
            onClick={removeLastWaypoint}
            disabled={waypoints.length === 0}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('airportInfo.taxiRoute.undo', 'Undo last point')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearRoute}
            disabled={waypoints.length === 0}
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
            onClick={deactivate}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title={t('common.close', 'Close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Instructions or waypoint count */}
      {clickModeEnabled && waypoints.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/50">
          {t('airportInfo.taxiRoute.clickInstruction', 'Click on the map to add taxi route points')}
        </p>
      ) : clickModeEnabled && waypoints.length > 0 ? (
        <p className="text-[10px] text-cat-emerald/60">
          {t('airportInfo.taxiRoute.pointsPlaced', {
            count: waypoints.length,
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
