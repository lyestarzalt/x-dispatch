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
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/helpers';
import {
  formatDistance,
  formatFlightTime,
  formatFuel,
  formatWeight,
  useSimbriefFetch,
} from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SimBriefOFP } from '@/types/simbrief';
import {
  BriefingTab,
  FmsExportSection,
  NavlogTab,
  PerformanceTab,
  VerticalProfile,
} from './components';

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
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);
  const fetchMutation = useSimbriefFetch();

  // Fresh fetch wins over previously imported data; otherwise fall back to the
  // in-memory OFP so re-opening the dialog after import shows the tabbed view.
  const ofp = fetchMutation.data ?? simbriefData;

  // Get unit from API response (SimBrief returns "lbs" or "kgs")
  const apiUnit = ofp ? getApiUnit(ofp) : 'lbs';

  const handleOpenPDF = () => {
    if (ofp?.files.pdf.link) {
      const fullUrl = ofp.files.directory + ofp.files.pdf.link;
      window.appAPI.openExternal(fullUrl);
    }
  };

  const handleFetch = () => {
    if (simbrief.pilotId) {
      fetchMutation.mutate(simbrief.pilotId);
    }
  };

  const handleImport = () => {
    if (ofp) {
      loadFromSimbrief(ofp);
      onClose();
    }
  };

  const isConfigured = !!simbrief.pilotId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        {/* Header with SimBrief branding */}
        <div className="from-background via-card to-background flex items-center justify-between border-b bg-gradient-to-r px-6 py-4">
          <div className="flex items-center gap-4">
            <SimbriefLogo size="md" className="opacity-90" />
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                {t('simbrief.title', 'Operational Flight Plan')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {t('simbrief.description', 'Import your latest dispatch from SimBrief')}
              </DialogDescription>
            </div>
          </div>
          {ofp && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFetch}
              disabled={fetchMutation.isPending}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {fetchMutation.isPending ? (
                <Spinner className="mr-2" />
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
            <div className="bg-warning/10 rounded-full p-4">
              <AlertCircle className="text-warning h-12 w-12" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium">
                {t('simbrief.notConfigured', 'SimBrief not configured')}
              </p>
              <p className="text-muted-foreground max-w-sm text-sm">
                {t(
                  'simbrief.configurePilotId',
                  'Configure your Pilot ID in Settings → SimBrief to import flight plans'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Configured - Fetch UI */}
        {isConfigured && !ofp && (
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            {fetchMutation.isPending ? (
              <>
                <div className="relative">
                  <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full" />
                  <div className="bg-primary/10 relative rounded-full p-4">
                    <Spinner className="text-primary size-12" />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t('simbrief.fetching', 'Fetching your latest dispatch...')}
                </p>
              </>
            ) : fetchMutation.isError ? (
              <>
                <div className="bg-destructive/10 rounded-full p-4">
                  <AlertCircle className="text-destructive h-12 w-12" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-destructive font-medium">
                    {t('simbrief.fetchError', 'Failed to fetch flight plan')}
                  </p>
                  <p className="text-muted-foreground text-sm">{fetchMutation.error.message}</p>
                </div>
                <Button onClick={handleFetch} variant="outline">
                  {t('common.retry', 'Retry')}
                </Button>
              </>
            ) : (
              <>
                <div className="bg-primary/10 rounded-full p-6">
                  <Plane className="text-primary h-16 w-16" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-lg font-medium">{t('simbrief.ready', 'Ready to Import')}</p>
                  <p className="text-muted-foreground max-w-sm text-sm">
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
        {ofp && (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-0">
              {/* Flight Header - OFP Style */}
              <FlightHeader data={ofp} onAirportClick={onClose} />

              {/* Main Content Tabs */}
              <div className="p-4">
                <Tabs defaultValue="flight" className="w-full">
                  <TabsList variant="line" className="mb-4">
                    <TabsTrigger value="flight" className="flex-1 gap-1.5 text-xs">
                      <Route className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.flight')}
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="flex-1 gap-1.5 text-xs">
                      <Zap className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.performance')}
                    </TabsTrigger>
                    <TabsTrigger value="navlog" className="flex-1 gap-1.5 text-xs">
                      <List className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.navlog')}
                    </TabsTrigger>
                    <TabsTrigger value="fuel" className="flex-1 gap-1.5 text-xs">
                      <Fuel className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.fuel')}
                    </TabsTrigger>
                    <TabsTrigger value="weights" className="flex-1 gap-1.5 text-xs">
                      <Scale className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.weights')}
                    </TabsTrigger>
                    <TabsTrigger value="weather" className="flex-1 gap-1.5 text-xs">
                      <Cloud className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.weather')}
                    </TabsTrigger>
                    <TabsTrigger value="briefing" className="flex-1 gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5" />
                      {t('simbriefDialog.tabs.briefing')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="flight" className="mt-0">
                    <FlightTab data={ofp} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="performance" className="mt-0">
                    <PerformanceTab data={ofp} />
                  </TabsContent>

                  <TabsContent value="navlog" className="mt-0">
                    <NavlogTab data={ofp} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="fuel" className="mt-0">
                    <FuelTab data={ofp} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="weights" className="mt-0">
                    <WeightsTab data={ofp} apiUnit={apiUnit} />
                  </TabsContent>

                  <TabsContent value="weather" className="mt-0">
                    <WeatherTab data={ofp} />
                  </TabsContent>

                  <TabsContent value="briefing" className="mt-0">
                    <BriefingTab data={ofp} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ScrollArea>
        )}

        {ofp && (
          <div className="bg-card/50 border-t px-6 py-3">
            <FmsExportSection data={ofp} />
          </div>
        )}

        <DialogFooter className="bg-muted/30 border-t px-6 py-4">
          <div className="flex w-full items-center justify-between">
            {ofp && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenPDF}
                className="text-muted-foreground gap-2 text-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('simbriefDialog.viewFullOfp')}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
              {ofp && (
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
function FlightHeader({
  data,
  onAirportClick,
}: {
  data: SimBriefOFP;
  /** Called after the user clicks an ICAO so the dialog can close itself. */
  onAirportClick: () => void;
}) {
  const { t } = useTranslation();
  const flightNumber = data.general.icao_airline
    ? `${data.general.icao_airline}${data.general.flight_number}`
    : data.atc.callsign;

  const handleIcaoClick = (icao: string) => {
    useAppStore.getState().requestSelectAirport(icao);
    onAirportClick();
  };

  return (
    <div className="from-background to-card bg-gradient-to-b px-6 py-5">
      <div className="flex items-start justify-between">
        {/* Route Display */}
        <div className="flex items-center gap-6">
          {/* Origin */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => handleIcaoClick(data.origin.icao_code)}
              className="h-auto p-0 font-mono text-3xl font-bold tracking-tight"
              aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                icao: data.origin.icao_code,
              })}
            >
              {data.origin.icao_code}
            </Button>
            <p className="text-muted-foreground mt-0.5 text-sm">{data.origin.name}</p>
            <div className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-sm">
              <PlaneTakeoff className="h-3 w-3" />
              <span>{t('simbriefDialog.header.runway', { rwy: data.origin.plan_rwy })}</span>
            </div>
          </div>

          {/* Flight Line */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="via-border to-border h-px w-12 bg-gradient-to-r from-transparent" />
              <Plane className="text-primary h-5 w-5 rotate-90" />
              <div className="from-border via-border h-px w-12 bg-gradient-to-r to-transparent" />
            </div>
            <span className="text-muted-foreground font-mono text-[10px]">
              {formatDistance(data.general.air_distance)}
            </span>
          </div>

          {/* Destination */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => handleIcaoClick(data.destination.icao_code)}
              className="h-auto p-0 font-mono text-3xl font-bold tracking-tight"
              aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                icao: data.destination.icao_code,
              })}
            >
              {data.destination.icao_code}
            </Button>
            <p className="text-muted-foreground mt-0.5 text-sm">{data.destination.name}</p>
            <div className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-sm">
              <PlaneLanding className="h-3 w-3" />
              <span>{t('simbriefDialog.header.runway', { rwy: data.destination.plan_rwy })}</span>
            </div>
          </div>
        </div>

        {/* Flight Info */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <Badge className="bg-primary/20 text-primary hover:bg-primary/20 font-mono text-sm font-bold">
              {flightNumber}
            </Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="text-muted-foreground flex items-center justify-end gap-2">
              <span>{data.aircraft.icao_code}</span>
              <span className="text-border">|</span>
              <span className="font-mono">
                {data.aircraft.reg || t('simbriefDialog.notAvailable')}
              </span>
            </div>
            <p className="text-muted-foreground">{data.aircraft.name}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-card/50 mt-5 flex items-center justify-between rounded-lg px-4 py-3">
        <StatItem
          icon={Timer}
          label={t('simbriefDialog.stats.ete')}
          value={formatFlightTime(data.times.est_time_enroute)}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem
          icon={Gauge}
          label={t('simbriefDialog.stats.fl')}
          value={data.general.initial_altitude}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem
          icon={Wind}
          label={t('simbriefDialog.stats.avgWind')}
          value={`${data.general.avg_wind_dir}°/${data.general.avg_wind_spd}kt`}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem
          icon={Navigation}
          label={t('simbriefDialog.stats.ci')}
          value={data.general.costindex}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem icon={Route} label={t('simbriefDialog.stats.airac')} value={data.general.airac} />
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
      <Icon className="text-muted-foreground h-4 w-4" />
      <div>
        <p className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</p>
        <p className="font-mono text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

// Flight Tab (with vertical profile)
function FlightTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {/* Vertical Profile */}
      <div className="bg-card rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.flight.verticalProfile')}
          </h4>
          <div className="flex items-center gap-2">
            {data.general.sid_ident && (
              <Badge variant="secondary" className="text-[10px]">
                {t('simbriefDialog.flight.sid', { id: data.general.sid_ident })}
              </Badge>
            )}
            {data.general.star_ident && (
              <Badge variant="secondary" className="text-[10px]">
                {t('simbriefDialog.flight.star', { id: data.general.star_ident })}
              </Badge>
            )}
          </div>
        </div>
        <VerticalProfile fixes={data.navlog.fix} className="h-48" />
      </div>

      {/* Route String */}
      <div className="bg-card rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.flight.route')}
          </h4>
          <Badge variant="outline" className="text-[10px]">
            {t('simbriefDialog.flight.fixesCount', { count: data.navlog.fix.length })}
          </Badge>
        </div>
        <p className="text-foreground/80 font-mono text-sm leading-relaxed">{data.general.route}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Fuel Summary */}
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <Fuel className="h-3.5 w-3.5" />
            {t('simbriefDialog.flight.fuelSummary')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.blockFuel')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatFuel(data.fuel.plan_ramp, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.tripFuel')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatFuel(data.fuel.enroute_burn, apiUnit)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.landingFuel')}
              </span>
              <span className="text-success font-mono text-sm font-medium">
                {formatFuel(data.fuel.plan_landing, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Weights Summary */}
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <Scale className="h-3.5 w-3.5" />
            {t('simbriefDialog.flight.weightsSummary')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.weights.zfw')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_zfw, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.weights.tow')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_tow, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.weights.ldw')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_ldw, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Payload */}
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <Users className="h-3.5 w-3.5" />
            {t('simbriefDialog.flight.payload')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.passengers')}
              </span>
              <span className="font-mono text-sm font-medium">{data.weights.pax_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.cargo')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.cargo, apiUnit)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.totalPayload')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.payload, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Alternate */}
        {data.alternate && (
          <div className="bg-card rounded-lg border p-4">
            <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
              <PlaneLanding className="h-3.5 w-3.5" />
              {t('simbriefDialog.flight.alternate')}
            </h4>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold">{data.alternate.icao_code}</span>
              <div>
                <p className="text-sm">{data.alternate.name}</p>
                <p className="text-muted-foreground text-sm">
                  {t('simbriefDialog.header.runway', { rwy: data.alternate.plan_rwy })}
                </p>
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
  const { t } = useTranslation();
  const totalFuel = parseInt(data.fuel.plan_ramp, 10);
  const fuelItems = [
    {
      id: 'taxi',
      label: t('simbriefDialog.fuelTab.taxi'),
      value: data.fuel.taxi,
      color: 'bg-muted-foreground',
    },
    {
      id: 'trip',
      label: t('simbriefDialog.fuelTab.trip'),
      value: data.fuel.enroute_burn,
      color: 'bg-primary',
    },
    {
      id: 'contingency',
      label: t('simbriefDialog.fuelTab.contingency'),
      value: data.fuel.contingency,
      color: 'bg-warning',
    },
    {
      id: 'alternate',
      label: t('simbriefDialog.fuelTab.alternate'),
      value: data.fuel.alternate_burn,
      color: 'bg-warning',
    },
    {
      id: 'finalReserve',
      label: t('simbriefDialog.fuelTab.finalReserve'),
      value: data.fuel.reserve,
      color: 'bg-destructive',
    },
    {
      id: 'extra',
      label: t('simbriefDialog.fuelTab.extra'),
      value: data.fuel.extra,
      color: 'bg-success',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Fuel Breakdown Visual */}
      <div className="bg-card rounded-lg border p-4">
        <h4 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
          {t('simbriefDialog.fuelTab.breakdown')}
        </h4>
        <div className="space-y-3">
          {fuelItems.map((item) => {
            const amount = parseInt(item.value, 10);
            const percentage = (amount / totalFuel) * 100;
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', item.color)} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono font-medium">{formatFuel(item.value, apiUnit)}</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
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
        <div className="bg-primary/5 rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t('simbriefDialog.fuelTab.blockFuel')}
          </p>
          <p className="text-primary mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_ramp, apiUnit)}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t('simbriefDialog.fuelTab.takeoffFuel')}
          </p>
          <p className="mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_takeoff, apiUnit)}
          </p>
        </div>
        <div className="bg-success/5 rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t('simbriefDialog.fuelTab.landingFuel')}
          </p>
          <p className="text-success mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Weights Tab
function WeightsTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const weights = [
    {
      label: t('simbriefDialog.weights.zfwFull'),
      abbr: t('simbriefDialog.weights.zfw'),
      est: parseInt(data.weights.est_zfw, 10),
      max: parseInt(data.weights.max_zfw, 10),
    },
    {
      label: t('simbriefDialog.weights.towFull'),
      abbr: t('simbriefDialog.weights.tow'),
      est: parseInt(data.weights.est_tow, 10),
      max: parseInt(data.weights.max_tow, 10),
    },
    {
      label: t('simbriefDialog.weights.ldwFull'),
      abbr: t('simbriefDialog.weights.ldw'),
      est: parseInt(data.weights.est_ldw, 10),
      max: parseInt(data.weights.max_ldw, 10),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Weight Gauges */}
      <div className="bg-card rounded-lg border p-4">
        <h4 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
          {t('simbriefDialog.weightsTab.limits')}
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
                    <span className="text-muted-foreground text-sm">{w.label}</span>
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
                    <span className="text-muted-foreground text-sm">
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
                  <span className="absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[10px] font-bold text-white">
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
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.weightsTab.operating')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('simbriefDialog.weightsTab.oew')}</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.oew, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('simbriefDialog.weightsTab.payload')}
              </span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.payload, apiUnit)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('simbriefDialog.weights.zfw')}</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.est_zfw, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.weightsTab.details')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('simbriefDialog.weightsTab.passengers')}
              </span>
              <span className="font-mono font-medium">
                {t('simbriefDialog.weightsTab.paxCount', { count: data.weights.pax_count })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('simbriefDialog.weightsTab.cargo')}</span>
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
  const { t } = useTranslation();
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

  const alternateMetarRaw = data.alternate?.metar;
  const altMetar = useMemo(() => {
    if (!alternateMetarRaw) return null;
    try {
      return parseMetar(alternateMetarRaw);
    } catch {
      return null;
    }
  }, [alternateMetarRaw]);

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
          label={t('simbriefDialog.weather.alternate')}
          rawMetar={data.alternate.metar}
          parsedMetar={altMetar}
        />
      )}

      {/* Winds Aloft */}
      <div className="bg-card rounded-lg border p-4">
        <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
          <Wind className="h-3.5 w-3.5" />
          {t('simbriefDialog.weather.windsAloft')}
        </h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <Wind
                className="h-6 w-6"
                style={{ transform: `rotate(${parseInt(data.general.avg_wind_dir, 10)}deg)` }}
              />
            </div>
            <div>
              <p className="font-mono text-2xl font-bold">
                {t('simbriefDialog.weather.directionDeg', { deg: data.general.avg_wind_dir })}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('simbriefDialog.weather.direction')}
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div>
            <p className="font-mono text-2xl font-bold">
              {t('simbriefDialog.weather.speedKt', { speed: data.general.avg_wind_spd })}
            </p>
            <p className="text-muted-foreground text-xs">{t('simbriefDialog.weather.speed')}</p>
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
  const { t } = useTranslation();
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
          <Icon className="h-3.5 w-3.5" />
          {label ? t('simbriefDialog.weather.icaoWithLabel', { icao, label }) : icao}
        </h4>
        <Badge variant="outline" className="text-[10px]">
          {t('simbriefDialog.weather.metar')}
        </Badge>
      </div>

      {/* Decoded METAR Display */}
      {parsedMetar && (
        <div className="mb-3 grid grid-cols-5 gap-2">
          <MetarItem
            icon={Wind}
            label={t('simbriefDialog.weather.wind')}
            value={formatWind(parsedMetar.wind)}
          />
          <MetarItem
            icon={Eye}
            label={t('simbriefDialog.weather.visibility')}
            value={formatVisibility(parsedMetar.visibility, parsedMetar.cavok)}
          />
          <MetarItem
            icon={Cloud}
            label={t('simbriefDialog.weather.ceiling')}
            value={formatCeiling(parsedMetar.clouds, parsedMetar.verticalVisibility)}
          />
          <MetarItem
            icon={Thermometer}
            label={t('simbriefDialog.weather.temp')}
            value={parsedMetar.temperature !== undefined ? `${parsedMetar.temperature}°C` : '—'}
          />
          <MetarItem
            icon={Gauge}
            label={t('simbriefDialog.weather.qnh')}
            value={formatAltimeter(parsedMetar.altimeter)}
          />
        </div>
      )}

      {/* Weather conditions */}
      {parsedMetar?.weatherConditions && parsedMetar.weatherConditions.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <Droplets className="text-muted-foreground h-3.5 w-3.5" />
          <span className="font-mono text-sm font-medium">
            {formatWeatherConditions(parsedMetar.weatherConditions)}
          </span>
        </div>
      )}

      {/* Raw METAR */}
      <div className="bg-muted/50 rounded p-3">
        <p className="font-mono text-sm leading-relaxed">
          {rawMetar || t('simbriefDialog.noMetarAvailable')}
        </p>
      </div>

      {/* TAF */}
      {taf && (
        <div className="mt-3">
          <Badge variant="outline" className="mb-2 text-[10px]">
            {t('simbriefDialog.weather.taf')}
          </Badge>
          <div className="bg-muted/50 rounded p-3">
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
    <div className="bg-muted/40 rounded-lg p-2 text-center">
      <Icon className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
      <p className="font-mono text-xs font-medium">{value}</p>
      <p className="text-muted-foreground text-[9px]">{label}</p>
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
