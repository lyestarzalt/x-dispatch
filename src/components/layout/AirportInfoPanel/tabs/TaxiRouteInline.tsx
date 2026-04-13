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
        <div className="flex items-center gap-1.5 text-cat-emerald/80">
          <CircleDot className="h-3 w-3" />
          <span className="text-[11px] font-medium">
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
            title="Undo last point"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearRoute}
            disabled={waypoints.length === 0}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title="Clear all"
          >
            <Eraser className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setClickModeEnabled(!clickModeEnabled)}
            className={`h-6 w-6 ${clickModeEnabled ? 'text-cat-emerald' : 'text-muted-foreground/60 hover:text-foreground'}`}
            title={clickModeEnabled ? 'Disable click-to-add' : 'Enable click-to-add'}
          >
            <MousePointerClick className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={deactivate}
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Instructions or waypoint count */}
      {clickModeEnabled && waypoints.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/50">
          Click on the map to add taxi route points
        </p>
      ) : clickModeEnabled && waypoints.length > 0 ? (
        <p className="text-[10px] text-cat-emerald/60">
          {waypoints.length} point{waypoints.length !== 1 ? 's' : ''} placed — click to add more
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground/50">
          Click the <MousePointerClick className="inline h-2.5 w-2.5" /> button to enable
          click-to-add
        </p>
      )}
    </div>
  );
}
