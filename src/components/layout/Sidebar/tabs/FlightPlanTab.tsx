/**
 * Flight Plan Tab
 * Simple UI for entering and viewing a flight plan route
 */
import { useCallback, useState } from 'react';
import { Plane, Plus, Route, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/helpers';
import { useFlightPlanStore } from '@/stores/flightPlanStore';

export default function FlightPlanTab() {
  const [routeInput, setRouteInput] = useState('');
  const { departure, arrival, route, parseRouteString, clearAll, removeWaypoint } =
    useFlightPlanStore();

  const handleParseRoute = useCallback(() => {
    if (routeInput.trim()) {
      parseRouteString(routeInput);
      setRouteInput('');
    }
  }, [routeInput, parseRouteString]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleParseRoute();
      }
    },
    [handleParseRoute]
  );

  const hasRoute = departure || arrival || route.length > 0;

  return (
    <div className="space-y-4">
      {/* Route Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Enter Route
        </label>
        <div className="flex gap-2">
          <Input
            value={routeInput}
            onChange={(e) => setRouteInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="KJFK LOGEN J42 BOS KBOS"
            className="flex-1 font-mono text-sm"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={handleParseRoute}
            disabled={!routeInput.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter waypoints separated by spaces. Airways like J42, V123 will be parsed.
        </p>
      </div>

      {/* Current Flight Plan */}
      {hasRoute && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Flight Plan
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearAll}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30">
            {/* Departure */}
            {departure && (
              <div className="flex items-center gap-3 border-b border-border/30 px-3 py-2">
                <Plane className="h-4 w-4 rotate-45 text-emerald-400" />
                <div className="flex-1">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {departure.icao}
                  </span>
                  {departure.runway && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      RWY {departure.runway}
                    </span>
                  )}
                  {departure.procedure && (
                    <span className="ml-2 text-xs text-primary">{departure.procedure}</span>
                  )}
                </div>
              </div>
            )}

            {/* Route Waypoints */}
            {route.map((wp, index) => (
              <div
                key={`${wp.id}-${index}`}
                className="group flex items-center gap-3 border-b border-border/30 px-3 py-2 last:border-b-0"
              >
                <div
                  className={cn(
                    'flex h-4 w-4 items-center justify-center',
                    wp.via ? 'text-sky-400' : 'text-muted-foreground'
                  )}
                >
                  {wp.via ? <Route className="h-4 w-4" /> : <span className="text-xs">•</span>}
                </div>
                <div className="flex-1">
                  {wp.via && <span className="mr-2 text-xs text-sky-400">{wp.via}</span>}
                  <span className="font-mono text-sm text-foreground">{wp.id}</span>
                  {wp.latitude && wp.longitude && (
                    <span className="ml-2 text-xs text-emerald-400">✓</span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => removeWaypoint(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {/* Arrival */}
            {arrival && (
              <div className="flex items-center gap-3 px-3 py-2">
                <Plane className="h-4 w-4 -rotate-45 text-amber-400" />
                <div className="flex-1">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {arrival.icao}
                  </span>
                  {arrival.runway && (
                    <span className="ml-2 text-xs text-muted-foreground">RWY {arrival.runway}</span>
                  )}
                  {arrival.procedure && (
                    <span className="ml-2 text-xs text-primary">{arrival.procedure}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Route Summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {route.length} waypoint{route.length !== 1 ? 's' : ''}
            </span>
            {departure && arrival && (
              <span className="font-mono">
                {departure.icao} → {arrival.icao}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasRoute && (
        <div className="py-8 text-center">
          <Route className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No flight plan entered</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Enter a route string above to get started
          </p>
        </div>
      )}
    </div>
  );
}
