import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Cloud,
  Droplets,
  ExternalLink,
  Eye,
  FileText,
  Fuel,
  Gauge,
  List,
  Loader2,
  Navigation,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  RefreshCw,
  Route,
  Scale,
  Thermometer,
  Timer,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import { CloudQuantity, DistanceUnit, Intensity, parseMetar } from 'metar-taf-parser';
import type {
  IAltimeter,
  ICloud,
  IMetar,
  IWeatherCondition,
  IWind,
  Visibility,
} from 'metar-taf-parser';
import { SimbriefLogo } from '@/components/ui/SimbriefLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/helpers';
import {
  formatDistance,
  formatFlightTime,
  formatFuel,
  formatWeight,
  useSimbriefFetch,
} from '@/queries/useSimbriefQuery';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SimBriefOFP } from '@/types/simbrief';
import { BriefingTab, NavlogTab, PerformanceTab, VerticalProfile } from './components';

// Helper to get unit from API response
function getApiUnit(data: SimBriefOFP): string {
  return data.params.units;
}

interface SimbriefDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SimbriefDialog({ open, onClose }: SimbriefDialogProps) {
  const { t } = useTranslation();
  const { simbrief } = useSettingsStore();
  const { loadFromSimbrief } = useFlightPlanStore();
  const fetchMutation = useSimbriefFetch();

  // Get unit from API response (SimBrief returns "lbs" or "kgs")
  const apiUnit = fetchMutation.data ? getApiUnit(fetchMutation.data) : 'lbs';

  const handleOpenPDF = () => {
    if (fetchMutation.data?.files.pdf.link) {
      const fullUrl = fetchMutation.data.files.directory + fetchMutation.data.files.pdf.link;
      window.appAPI.openExternal(fullUrl);
    }
  };

  const handleFetch = () => {
    if (simbrief.pilotId) {
      fetchMutation.mutate(simbrief.pilotId);
    }
  };

  const handleImport = () => {
    if (fetchMutation.data) {
      loadFromSimbrief(fetchMutation.data);
      onClose();
    }
  };

  const isConfigured = !!simbrief.pilotId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        {/* Header with SimBrief branding */}
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-background via-card to-background px-6 py-4">
          <div className="flex items-center gap-4">
            <SimbriefLogo size="md" className="opacity-90" />
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                {t('simbrief.title', 'Operational Flight Plan')}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t('simbrief.description', 'Import your latest dispatch from SimBrief')}
              </DialogDescription>
            </div>
          </div>
          {fetchMutation.data && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFetch}
              disabled={fetchMutation.isPending}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {fetchMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('simbrief.refetch', 'Refresh')}
            </Button>
          )}
        </div>

        {/* Not Configured State */}
        {!isConfigured && (
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="rounded-full bg-warning/10 p-4">
              <AlertCircle className="h-12 w-12 text-warning" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium">
                {t('simbrief.notConfigured', 'SimBrief not configured')}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t(
                  'simbrief.configurePilotId',
                  'Configure your Pilot ID in Settings → SimBrief to import flight plans'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Configured - Fetch UI */}
        {isConfigured && !fetchMutation.data && (
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            {fetchMutation.isPending ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <div className="relative rounded-full bg-primary/10 p-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('simbrief.fetching', 'Fetching your latest dispatch...')}
                </p>
              </>
            ) : fetchMutation.isError ? (
              <>
                <div className="rounded-full bg-destructive/10 p-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="font-medium text-destructive">
                    {t('simbrief.fetchError', 'Failed to fetch flight plan')}
                  </p>
                  <p className="text-sm text-muted-foreground">{fetchMutation.error.message}</p>
                </div>
                <Button onClick={handleFetch} variant="outline">
                  {t('common.retry', 'Retry')}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-full bg-primary/10 p-6">
                  <Plane className="h-16 w-16 text-primary" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-lg font-medium">{t('simbrief.ready', 'Ready to Import')}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {t(
                      'simbrief.clickToFetch',
                      'Imports your most recently generated flight plan from SimBrief. Make sure to generate one on simbrief.com first.'
                    )}
                  </p>
                </div>
                <Button onClick={handleFetch} size="lg" className="gap-2">
                  <SimbriefLogo size="xs" className="brightness-0 invert" />
                  {t('simbrief.fetchLatest', 'Fetch Latest OFP')}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Flight Plan Preview */}
        {fetchMutation.data && (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-0">
              {/* Flight Header - OFP Style */}
              <FlightHeader data={fetchMutation.data} />

              {/* Main Content Tabs */}
              <div className="p-4">
                <Tabs defaultValue="flight" className="w-full">
                  <TabsList className="mb-4 grid w-full grid-cols-7">
                    <TabsTrigger value="flight" className="gap-1.5 text-sm">
                      <Route className="h-3.5 w-3.5" />
                      Flight
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="gap-1.5 text-sm">
                      <Zap className="h-3.5 w-3.5" />
                      Perf
                    </TabsTrigger>
                    <TabsTrigger value="navlog" className="gap-1.5 text-sm">
                      <List className="h-3.5 w-3.5" />
                      Navlog
                    </TabsTrigger>
                    <TabsTrigger value="fuel" className="gap-1.5 text-sm">
                      <Fuel className="h-3.5 w-3.5" />
                      Fuel
                    </TabsTrigger>
                    <TabsTrigger value="weights" className="gap-1.5 text-sm">
                      <Scale className="h-3.5 w-3.5" />
                      Weights
                    </TabsTrigger>
                    <TabsTrigger value="weather" className="gap-1.5 text-sm">
                      <Cloud className="h-3.5 w-3.5" />
                      Weather
                    </TabsTrigger>
                    <TabsTrigger value="briefing" className="gap-1.5 text-sm">
                      <FileText className="h-3.5 w-3.5" />
                      Briefing
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="flight" className="mt-0">
                    <FlightTab data={fetchMutation.data} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="performance" className="mt-0">
                    <PerformanceTab data={fetchMutation.data} />
                  </TabsContent>

                  <TabsContent value="navlog" className="mt-0">
                    <NavlogTab data={fetchMutation.data} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="fuel" className="mt-0">
                    <FuelTab data={fetchMutation.data} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="weights" className="mt-0">
                    <WeightsTab data={fetchMutation.data} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="weather" className="mt-0">
                    <WeatherTab data={fetchMutation.data} />
                  </TabsContent>

                  <TabsContent value="briefing" className="mt-0">
                    <BriefingTab data={fetchMutation.data} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <div className="flex w-full items-center justify-between">
            {fetchMutation.data && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenPDF}
                className="gap-2 text-sm text-muted-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Full OFP (PDF)
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
              {fetchMutation.data && (
                <Button onClick={handleImport} className="gap-2">
                  <Route className="h-4 w-4" />
                  {t('simbrief.import', 'Import Flight Plan')}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Flight Header Component - Airline dispatch style
function FlightHeader({ data }: { data: SimBriefOFP }) {
  const flightNumber = data.general.icao_airline
    ? `${data.general.icao_airline}${data.general.flight_number}`
    : data.atc.callsign;

  return (
    <div className="bg-gradient-to-b from-background to-card px-6 py-5">
      <div className="flex items-start justify-between">
        {/* Route Display */}
        <div className="flex items-center gap-6">
          {/* Origin */}
          <div className="text-center">
            <p className="font-mono text-3xl font-bold tracking-tight text-white">
              {data.origin.icao_code}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{data.origin.name}</p>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <PlaneTakeoff className="h-3 w-3" />
              <span>RWY {data.origin.plan_rwy}</span>
            </div>
          </div>

          {/* Flight Line */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-border to-border" />
              <Plane className="h-5 w-5 rotate-90 text-primary" />
              <div className="h-px w-12 bg-gradient-to-r from-border via-border to-transparent" />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatDistance(data.general.air_distance)}
            </span>
          </div>

          {/* Destination */}
          <div className="text-center">
            <p className="font-mono text-3xl font-bold tracking-tight text-white">
              {data.destination.icao_code}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{data.destination.name}</p>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <PlaneLanding className="h-3 w-3" />
              <span>RWY {data.destination.plan_rwy}</span>
            </div>
          </div>
        </div>

        {/* Flight Info */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <Badge className="bg-primary/20 font-mono text-sm font-bold text-primary hover:bg-primary/20">
              {flightNumber}
            </Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center justify-end gap-2 text-muted-foreground">
              <span>{data.aircraft.icao_code}</span>
              <span className="text-border">|</span>
              <span className="font-mono">{data.aircraft.reg || 'N/A'}</span>
            </div>
            <p className="text-muted-foreground">{data.aircraft.name}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="mt-5 flex items-center justify-between rounded-lg bg-card/50 px-4 py-3">
        <StatItem icon={Timer} label="ETE" value={formatFlightTime(data.times.est_time_enroute)} />
        <Separator orientation="vertical" className="h-8 bg-border" />
        <StatItem icon={Gauge} label="FL" value={data.general.initial_altitude} />
        <Separator orientation="vertical" className="h-8 bg-border" />
        <StatItem
          icon={Wind}
          label="AVG WIND"
          value={`${data.general.avg_wind_dir}°/${data.general.avg_wind_spd}kt`}
        />
        <Separator orientation="vertical" className="h-8 bg-border" />
        <StatItem icon={Navigation} label="CI" value={data.general.costindex} />
        <Separator orientation="vertical" className="h-8 bg-border" />
        <StatItem icon={Route} label="AIRAC" value={data.general.airac} />
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

// Flight Tab (with vertical profile)
function FlightTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  return (
    <div className="space-y-4">
      {/* Vertical Profile */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Vertical Profile
          </h4>
          <div className="flex items-center gap-2">
            {data.general.sid_ident && (
              <Badge variant="secondary" className="text-[10px]">
                SID: {data.general.sid_ident}
              </Badge>
            )}
            {data.general.star_ident && (
              <Badge variant="secondary" className="text-[10px]">
                STAR: {data.general.star_ident}
              </Badge>
            )}
          </div>
        </div>
        <VerticalProfile fixes={data.navlog.fix} className="h-48" />
      </div>

      {/* Route String */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Route
          </h4>
          <Badge variant="outline" className="text-[10px]">
            {data.navlog.fix.length} fixes
          </Badge>
        </div>
        <p className="font-mono text-sm leading-relaxed text-foreground/80">{data.general.route}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Fuel Summary */}
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Fuel className="h-3.5 w-3.5" />
            Fuel Summary
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Block Fuel</span>
              <span className="font-mono text-sm font-medium">
                {formatFuel(data.fuel.plan_ramp, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Trip Fuel</span>
              <span className="font-mono text-sm font-medium">
                {formatFuel(data.fuel.enroute_burn, apiUnit)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Landing Fuel</span>
              <span className="font-mono text-sm font-medium text-success">
                {formatFuel(data.fuel.plan_landing, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Weights Summary */}
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            Weights Summary
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">ZFW</span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_zfw, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">TOW</span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_tow, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">LDW</span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_ldw, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Payload */}
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Payload
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Passengers</span>
              <span className="font-mono text-sm font-medium">{data.weights.pax_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cargo</span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.cargo, apiUnit)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Payload</span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.payload, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Alternate */}
        {data.alternate && (
          <div className="rounded-lg border bg-card p-4">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <PlaneLanding className="h-3.5 w-3.5" />
              Alternate
            </h4>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold">{data.alternate.icao_code}</span>
              <div>
                <p className="text-sm">{data.alternate.name}</p>
                <p className="text-sm text-muted-foreground">RWY {data.alternate.plan_rwy}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Fuel Tab
function FuelTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const totalFuel = parseInt(data.fuel.plan_ramp, 10);
  const fuelItems = [
    { label: 'Taxi', value: data.fuel.taxi, color: 'bg-muted-foreground' },
    { label: 'Trip', value: data.fuel.enroute_burn, color: 'bg-primary' },
    { label: 'Contingency', value: data.fuel.contingency, color: 'bg-warning' },
    { label: 'Alternate', value: data.fuel.alternate_burn, color: 'bg-warning' },
    { label: 'Final Reserve', value: data.fuel.reserve, color: 'bg-destructive' },
    { label: 'Extra', value: data.fuel.extra, color: 'bg-success' },
  ];

  return (
    <div className="space-y-4">
      {/* Fuel Breakdown Visual */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Fuel Breakdown
        </h4>
        <div className="space-y-3">
          {fuelItems.map((item) => {
            const amount = parseInt(item.value, 10);
            const percentage = (amount / totalFuel) * 100;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', item.color)} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono font-medium">{formatFuel(item.value, apiUnit)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full transition-all', item.color)}
                    style={{ width: `${Math.max(percentage, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fuel Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-primary/5 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Block Fuel</p>
          <p className="mt-1 font-mono text-xl font-bold text-primary">
            {formatFuel(data.fuel.plan_ramp, apiUnit)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Takeoff Fuel</p>
          <p className="mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_takeoff, apiUnit)}
          </p>
        </div>
        <div className="rounded-lg border bg-success/5 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Landing Fuel</p>
          <p className="mt-1 font-mono text-xl font-bold text-success">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Weights Tab
function WeightsTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const weights = [
    {
      label: 'Zero Fuel Weight',
      abbr: 'ZFW',
      est: parseInt(data.weights.est_zfw, 10),
      max: parseInt(data.weights.max_zfw, 10),
    },
    {
      label: 'Takeoff Weight',
      abbr: 'TOW',
      est: parseInt(data.weights.est_tow, 10),
      max: parseInt(data.weights.max_tow, 10),
    },
    {
      label: 'Landing Weight',
      abbr: 'LDW',
      est: parseInt(data.weights.est_ldw, 10),
      max: parseInt(data.weights.max_ldw, 10),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Weight Gauges */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Weight Limits
        </h4>
        <div className="space-y-5">
          {weights.map((w) => {
            const percentage = (w.est / w.max) * 100;
            const isWarning = percentage > 95;
            const isCritical = percentage > 100;
            return (
              <div key={w.abbr} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{w.abbr}</span>
                    <span className="text-sm text-muted-foreground">{w.label}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'font-mono text-sm font-medium',
                        isCritical && 'text-destructive',
                        isWarning && !isCritical && 'text-warning'
                      )}
                    >
                      {formatWeight(w.est.toString(), apiUnit)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {' '}
                      / {formatWeight(w.max.toString(), apiUnit)}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={cn(
                      'h-3',
                      isCritical && '[&>div]:bg-destructive',
                      isWarning && !isCritical && '[&>div]:bg-warning'
                    )}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-white">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weight Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Operating Weights
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">OEW</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.oew, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payload</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.payload, apiUnit)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ZFW</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.est_zfw, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Payload Details
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Passengers</span>
              <span className="font-mono font-medium">{data.weights.pax_count} pax</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cargo</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.cargo, apiUnit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Weather Tab
function WeatherTab({ data }: { data: SimBriefOFP }) {
  // Parse METARs
  const originMetar = useMemo(() => {
    if (!data.origin.metar) return null;
    try {
      return parseMetar(data.origin.metar);
    } catch {
      return null;
    }
  }, [data.origin.metar]);

  const destMetar = useMemo(() => {
    if (!data.destination.metar) return null;
    try {
      return parseMetar(data.destination.metar);
    } catch {
      return null;
    }
  }, [data.destination.metar]);

  const altMetar = useMemo(() => {
    if (!data.alternate?.metar) return null;
    try {
      return parseMetar(data.alternate.metar);
    } catch {
      return null;
    }
  }, [data.alternate?.metar]);

  return (
    <div className="space-y-4">
      {/* Origin Weather */}
      <MetarCard
        icao={data.origin.icao_code}
        icon={PlaneTakeoff}
        rawMetar={data.origin.metar}
        parsedMetar={originMetar}
        taf={data.origin.taf}
      />

      {/* Destination Weather */}
      <MetarCard
        icao={data.destination.icao_code}
        icon={PlaneLanding}
        rawMetar={data.destination.metar}
        parsedMetar={destMetar}
        taf={data.destination.taf}
      />

      {/* Alternate Weather */}
      {data.alternate && (
        <MetarCard
          icao={data.alternate.icao_code}
          icon={Route}
          label="Alternate"
          rawMetar={data.alternate.metar}
          parsedMetar={altMetar}
        />
      )}

      {/* Winds Aloft */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Wind className="h-3.5 w-3.5" />
          Average Winds Aloft
        </h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wind
                className="h-6 w-6"
                style={{ transform: `rotate(${parseInt(data.general.avg_wind_dir, 10)}deg)` }}
              />
            </div>
            <div>
              <p className="font-mono text-2xl font-bold">{data.general.avg_wind_dir}°</p>
              <p className="text-xs text-muted-foreground">Direction</p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div>
            <p className="font-mono text-2xl font-bold">{data.general.avg_wind_spd} kt</p>
            <p className="text-xs text-muted-foreground">Speed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// METAR Card Component with decoded display
function MetarCard({
  icao,
  icon: Icon,
  label,
  rawMetar,
  parsedMetar,
  taf,
}: {
  icao: string;
  icon: typeof PlaneTakeoff;
  label?: string;
  rawMetar: string;
  parsedMetar: IMetar | null;
  taf?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {icao} {label && `(${label})`}
        </h4>
        <Badge variant="outline" className="text-[10px]">
          METAR
        </Badge>
      </div>

      {/* Decoded METAR Display */}
      {parsedMetar && (
        <div className="mb-3 grid grid-cols-5 gap-2">
          <MetarItem icon={Wind} label="Wind" value={formatWind(parsedMetar.wind)} />
          <MetarItem
            icon={Eye}
            label="Visibility"
            value={formatVisibility(parsedMetar.visibility, parsedMetar.cavok)}
          />
          <MetarItem
            icon={Cloud}
            label="Ceiling"
            value={formatCeiling(parsedMetar.clouds, parsedMetar.verticalVisibility)}
          />
          <MetarItem
            icon={Thermometer}
            label="Temp"
            value={parsedMetar.temperature !== undefined ? `${parsedMetar.temperature}°C` : '—'}
          />
          <MetarItem icon={Gauge} label="QNH" value={formatAltimeter(parsedMetar.altimeter)} />
        </div>
      )}

      {/* Weather conditions */}
      {parsedMetar?.weatherConditions && parsedMetar.weatherConditions.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">
            {formatWeatherConditions(parsedMetar.weatherConditions)}
          </span>
        </div>
      )}

      {/* Raw METAR */}
      <div className="rounded bg-muted/50 p-3">
        <p className="font-mono text-sm leading-relaxed">{rawMetar || 'No METAR available'}</p>
      </div>

      {/* TAF */}
      {taf && (
        <div className="mt-3">
          <Badge variant="outline" className="mb-2 text-[10px]">
            TAF
          </Badge>
          <div className="rounded bg-muted/50 p-3">
            <p className="font-mono text-sm leading-relaxed">{taf}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetarItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
      <p className="font-mono text-xs font-medium">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// METAR formatting helpers
function formatWind(wind: IWind | undefined): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'CALM';
  const dir = wind.degrees !== undefined ? `${String(wind.degrees).padStart(3, '0')}°` : 'VRB';
  const gust = wind.gust ? `G${wind.gust}` : '';
  return `${dir}/${wind.speed}${gust}kt`;
}

function formatVisibility(vis: Visibility | undefined, cavok?: true): string {
  if (cavok) return 'CAVOK';
  if (!vis) return '—';
  if (vis.unit === DistanceUnit.StatuteMiles) {
    if (vis.value >= 10) return '>10SM';
    return `${vis.value}SM`;
  }
  if (vis.value >= 9999) return '>10km';
  return `${(vis.value / 1000).toFixed(1)}km`;
}

function formatCeiling(clouds: ICloud[], verticalVisibility?: number): string {
  if (verticalVisibility !== undefined) {
    return `VV${String(verticalVisibility).padStart(3, '0')}`;
  }
  for (const cloud of clouds) {
    if (
      (cloud.quantity === CloudQuantity.BKN || cloud.quantity === CloudQuantity.OVC) &&
      cloud.height !== undefined
    ) {
      return `${cloud.quantity}${String(cloud.height).padStart(3, '0')}`;
    }
  }
  const hasClear = clouds.some(
    (c) => c.quantity === CloudQuantity.SKC || c.quantity === CloudQuantity.NSC
  );
  if (hasClear || clouds.length === 0) return 'CLR';
  if (clouds[0]?.height !== undefined) {
    return `${clouds[0].quantity}${String(clouds[0].height).padStart(3, '0')}`;
  }
  return '—';
}

function formatAltimeter(alt: IAltimeter | undefined): string {
  if (!alt) return '—';
  if (alt.unit === 'inHg') return `${alt.value.toFixed(2)}"`;
  return `${alt.value}hPa`;
}

function formatWeatherConditions(conditions: IWeatherCondition[]): string {
  return conditions
    .map((c) => {
      let str = '';
      if (c.intensity === Intensity.LIGHT) str += '-';
      else if (c.intensity === Intensity.HEAVY) str += '+';
      else if (c.intensity === Intensity.IN_VICINITY) str += 'VC';
      if (c.descriptive) str += c.descriptive;
      str += c.phenomenons.join('');
      return str;
    })
    .join(' ');
}
