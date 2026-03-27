import { Gauge, PlaneLanding, PlaneTakeoff, Thermometer, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import type { SimBriefOFP } from '@/types/simbrief';

interface PerformanceTabProps {
  data: SimBriefOFP;
}

export function PerformanceTab({ data }: PerformanceTabProps) {
  const { tlr, general, origin, destination } = data;

  // Get the planned runway data from TLR
  const takeoffRunway = tlr?.takeoff.runway.find(
    (r) => r.identifier === tlr.takeoff.conditions.planned_runway
  );
  const landingRunway = tlr?.landing.runway.find(
    (r) => r.identifier === tlr.landing.conditions.planned_runway
  );

  const takeoffConditions = tlr?.takeoff.conditions;
  const landingConditions = tlr?.landing.conditions;

  // Parse step climbs
  const stepClimbs = general.stepclimb_string ? parseStepClimbs(general.stepclimb_string) : [];

  return (
    <div className="space-y-4">
      {/* V-Speeds Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Takeoff Performance */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <PlaneTakeoff className="h-3.5 w-3.5" />
              Takeoff - {origin.icao_code}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              RWY {takeoffConditions?.planned_runway || origin.plan_rwy}
            </Badge>
          </div>

          {takeoffRunway ? (
            <div className="space-y-4">
              {/* V-Speeds */}
              <div className="grid grid-cols-3 gap-2">
                <SpeedBox label="V1" value={takeoffRunway.speeds_v1} unit="kt" color="warning" />
                <SpeedBox label="VR" value={takeoffRunway.speeds_vr} unit="kt" color="success" />
                <SpeedBox label="V2" value={takeoffRunway.speeds_v2} unit="kt" color="primary" />
              </div>

              <Separator />

              {/* Flex & Conditions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Flex Temp</p>
                    <p className="font-mono text-sm font-bold">
                      {takeoffRunway.flex_temperature
                        ? `${takeoffRunway.flex_temperature}°C`
                        : 'TOGA'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Wind</p>
                    <p className="font-mono text-sm font-bold">
                      {takeoffConditions?.wind_direction}°/{takeoffConditions?.wind_speed}kt
                    </p>
                  </div>
                </div>
              </div>

              {/* Runway Info */}
              <div className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Flaps</span>
                  <span className="font-mono font-medium">{takeoffRunway.flap_setting}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Thrust</span>
                  <span className="font-mono font-medium">{takeoffRunway.thrust_setting}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">RWY Length</span>
                  <span className="font-mono font-medium">
                    {parseInt(takeoffRunway.length, 10).toLocaleString()}m
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              TLR data not available
            </div>
          )}
        </div>

        {/* Landing Performance */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <PlaneLanding className="h-3.5 w-3.5" />
              Landing - {destination.icao_code}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              RWY {landingConditions?.planned_runway || destination.plan_rwy}
            </Badge>
          </div>

          {tlr?.landing ? (
            <div className="space-y-4">
              {/* Vref */}
              <div className="flex justify-center">
                <SpeedBox
                  label="Vref"
                  value={tlr.landing.distance_dry.speeds_vref}
                  unit="kt"
                  color="violet"
                  large
                />
              </div>

              <Separator />

              {/* Conditions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-violet" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Flaps</p>
                    <p className="font-mono text-sm font-bold">
                      {landingConditions?.flap_setting || tlr.landing.distance_dry.flap_setting}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Wind</p>
                    <p className="font-mono text-sm font-bold">
                      {landingConditions?.wind_direction}°/{landingConditions?.wind_speed}kt
                    </p>
                  </div>
                </div>
              </div>

              {/* Landing Distances */}
              <div className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">LDA (Dry)</span>
                  <span className="font-mono font-medium">
                    {parseInt(tlr.landing.distance_dry.factored_distance, 10).toLocaleString()}m
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">LDA (Wet)</span>
                  <span className="font-mono font-medium">
                    {parseInt(tlr.landing.distance_wet.factored_distance, 10).toLocaleString()}m
                  </span>
                </div>
                {landingRunway && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">RWY Length</span>
                    <span className="font-mono font-medium">
                      {parseInt(landingRunway.length, 10).toLocaleString()}m
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              TLR data not available
            </div>
          )}
        </div>
      </div>

      {/* Cruise Performance */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" />
          Cruise Performance
        </h4>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Initial FL</p>
            <p className="font-mono text-xl font-bold text-primary">{general.initial_altitude}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Cost Index</p>
            <p className="font-mono text-xl font-bold">{general.costindex}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Cruise Mach</p>
            <p className="font-mono text-xl font-bold">M{general.cruise_mach}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Cruise TAS</p>
            <p className="font-mono text-xl font-bold">{general.cruise_tas} kt</p>
          </div>
        </div>

        {/* Step Climbs */}
        {stepClimbs.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Step Climbs</p>
              <div className="flex flex-wrap gap-2">
                {stepClimbs.map((step, i) => (
                  <Badge key={i} variant="secondary" className="font-mono">
                    {step.altitude} @ {step.waypoint || `Step ${i + 1}`}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transition Altitudes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{origin.icao_code} Trans Alt</p>
              <p className="font-mono text-lg font-bold">{origin.trans_alt || '—'} ft</p>
            </div>
            <PlaneTakeoff className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{destination.icao_code} Trans Level</p>
              <p className="font-mono text-lg font-bold">FL{destination.trans_level || '—'}</p>
            </div>
            <PlaneLanding className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for V-speed boxes
function SpeedBox({
  label,
  value,
  unit,
  color,
  large,
}: {
  label: string;
  value: string;
  unit: string;
  color: 'warning' | 'success' | 'primary' | 'violet';
  large?: boolean;
}) {
  const colorClasses = {
    warning: 'bg-warning/10 text-warning border-warning/20',
    success: 'bg-success/10 text-success border-success/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    violet: 'bg-violet/10 text-violet border-violet/20',
  };

  return (
    <div
      className={cn('rounded-lg border p-2 text-center', colorClasses[color], large && 'px-6 py-3')}
    >
      <p className="text-[10px] font-medium uppercase opacity-80">{label}</p>
      <p className={cn('font-mono font-bold', large ? 'text-2xl' : 'text-lg')}>
        {value || '—'}
        <span className="ml-0.5 text-xs font-normal opacity-60">{unit}</span>
      </p>
    </div>
  );
}

// Parse step climb string like "FL350/N0452M084 FL370/N0449M085"
function parseStepClimbs(stepString: string): { altitude: string; waypoint?: string }[] {
  if (!stepString) return [];

  const steps: { altitude: string; waypoint?: string }[] = [];
  const parts = stepString.split(' ');

  for (const part of parts) {
    const match = part.match(/^(FL\d+)/);
    const altitude = match?.[1];
    if (altitude) {
      steps.push({ altitude });
    }
  }

  return steps;
}
