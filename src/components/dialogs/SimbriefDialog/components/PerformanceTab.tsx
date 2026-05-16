import { useTranslation } from 'react-i18next';
import { Gauge, PlaneLanding, PlaneTakeoff, Thermometer, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import type { SimBriefOFP } from '@/types/simbrief';

interface PerformanceTabProps {
  data: SimBriefOFP;
}

export function PerformanceTab({ data }: PerformanceTabProps) {
  const { t } = useTranslation();
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
              {t('simbriefDialog.header.takeoffWithIcao', { icao: origin.icao_code })}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {t('simbriefDialog.header.runway', {
                rwy: takeoffConditions?.planned_runway || origin.plan_rwy,
              })}
            </Badge>
          </div>

          {takeoffRunway ? (
            <div className="space-y-4">
              {/* V-Speeds */}
              <div className="grid grid-cols-3 gap-2">
                <SpeedBox
                  label={t('simbriefDialog.performance.vspeeds.v1')}
                  value={takeoffRunway.speeds_v1}
                  unit={t('units.kt')}
                  color="warning"
                />
                <SpeedBox
                  label={t('simbriefDialog.performance.vspeeds.vr')}
                  value={takeoffRunway.speeds_vr}
                  unit={t('units.kt')}
                  color="success"
                />
                <SpeedBox
                  label={t('simbriefDialog.performance.vspeeds.v2')}
                  value={takeoffRunway.speeds_v2}
                  unit={t('units.kt')}
                  color="primary"
                />
              </div>

              <Separator />

              {/* Flex & Conditions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t('simbriefDialog.performance.flexTemp')}
                    </p>
                    <p className="font-mono text-sm font-bold">
                      {takeoffRunway.flex_temperature
                        ? `${takeoffRunway.flex_temperature}°C`
                        : t('simbriefDialog.performance.togaThrust')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t('simbriefDialog.performance.wind')}
                    </p>
                    <p className="font-mono text-sm font-bold">
                      {t('simbriefDialog.performance.windDirSpeed', {
                        dir: takeoffConditions?.wind_direction ?? '',
                        speed: takeoffConditions?.wind_speed ?? '',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Runway Info */}
              <div className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('simbriefDialog.performance.flaps')}
                  </span>
                  <span className="font-mono font-medium">{takeoffRunway.flap_setting}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('simbriefDialog.performance.thrust')}
                  </span>
                  <span className="font-mono font-medium">{takeoffRunway.thrust_setting}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('simbriefDialog.performance.rwyLength')}
                  </span>
                  <span className="font-mono font-medium">
                    {t('simbriefDialog.performance.meters', {
                      value: parseInt(takeoffRunway.length, 10).toLocaleString(),
                    })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('simbriefDialog.performance.tlrNotAvailable')}
            </div>
          )}
        </div>

        {/* Landing Performance */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <PlaneLanding className="h-3.5 w-3.5" />
              {t('simbriefDialog.header.landingWithIcao', { icao: destination.icao_code })}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {t('simbriefDialog.header.runway', {
                rwy: landingConditions?.planned_runway || destination.plan_rwy,
              })}
            </Badge>
          </div>

          {tlr?.landing ? (
            <div className="space-y-4">
              {/* Vref */}
              <div className="flex justify-center">
                <SpeedBox
                  label={t('simbriefDialog.performance.vspeeds.vref')}
                  value={tlr.landing.distance_dry.speeds_vref}
                  unit={t('units.kt')}
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
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t('simbriefDialog.performance.flaps')}
                    </p>
                    <p className="font-mono text-sm font-bold">
                      {landingConditions?.flap_setting || tlr.landing.distance_dry.flap_setting}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t('simbriefDialog.performance.wind')}
                    </p>
                    <p className="font-mono text-sm font-bold">
                      {t('simbriefDialog.performance.windDirSpeed', {
                        dir: landingConditions?.wind_direction ?? '',
                        speed: landingConditions?.wind_speed ?? '',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Landing Distances */}
              <div className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('simbriefDialog.performance.ldaDry')}
                  </span>
                  <span className="font-mono font-medium">
                    {t('simbriefDialog.performance.meters', {
                      value: parseInt(
                        tlr.landing.distance_dry.factored_distance,
                        10
                      ).toLocaleString(),
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('simbriefDialog.performance.ldaWet')}
                  </span>
                  <span className="font-mono font-medium">
                    {t('simbriefDialog.performance.meters', {
                      value: parseInt(
                        tlr.landing.distance_wet.factored_distance,
                        10
                      ).toLocaleString(),
                    })}
                  </span>
                </div>
                {landingRunway && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('simbriefDialog.performance.rwyLength')}
                    </span>
                    <span className="font-mono font-medium">
                      {t('simbriefDialog.performance.meters', {
                        value: parseInt(landingRunway.length, 10).toLocaleString(),
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('simbriefDialog.performance.tlrNotAvailable')}
            </div>
          )}
        </div>
      </div>

      {/* Cruise Performance */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" />
          {t('simbriefDialog.performance.cruise')}
        </h4>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">
              {t('simbriefDialog.performance.initialFl')}
            </p>
            <p className="font-mono text-xl font-bold text-primary">{general.initial_altitude}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">
              {t('simbriefDialog.performance.costIndex')}
            </p>
            <p className="font-mono text-xl font-bold">{general.costindex}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">
              {t('simbriefDialog.performance.cruiseMach')}
            </p>
            <p className="font-mono text-xl font-bold">
              {t('simbriefDialog.performance.machValue', { mach: general.cruise_mach })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">
              {t('simbriefDialog.performance.cruiseTas')}
            </p>
            <p className="font-mono text-xl font-bold">
              {t('simbriefDialog.performance.tasKt', { tas: general.cruise_tas })}
            </p>
          </div>
        </div>

        {/* Step Climbs */}
        {stepClimbs.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {t('simbriefDialog.performance.stepClimbs')}
              </p>
              <div className="flex flex-wrap gap-2">
                {stepClimbs.map((step, i) => (
                  <Badge key={i} variant="secondary" className="font-mono">
                    {t('simbriefDialog.performance.stepLabel', {
                      altitude: step.altitude,
                      waypoint:
                        step.waypoint || t('simbriefDialog.performance.stepFallback', { n: i + 1 }),
                    })}
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
              <p className="text-sm text-muted-foreground">
                {t('simbriefDialog.performance.transAltOrigin', { icao: origin.icao_code })}
              </p>
              <p className="font-mono text-lg font-bold">
                {t('simbriefDialog.performance.feet', { value: origin.trans_alt || '—' })}
              </p>
            </div>
            <PlaneTakeoff className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('simbriefDialog.performance.transLevelDest', { icao: destination.icao_code })}
              </p>
              <p className="font-mono text-lg font-bold">
                {t('simbriefDialog.performance.flightLevel', {
                  value: destination.trans_level || '—',
                })}
              </p>
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
