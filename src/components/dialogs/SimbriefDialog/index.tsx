import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Cloud,
  ExternalLink,
  FileText,
  Fuel,
  List,
  Plane,
  RefreshCw,
  Route,
  Scale,
  Zap,
} from 'lucide-react';
import { SimbriefLogo } from '@/components/ui/SimbriefLogo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { describeSimbriefError } from '@/lib/simbrief/fetchError';
import { useTrackFeatureOpened } from '@/queries';
import { useSimbriefFetch } from '@/queries/useSimbriefQuery';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SimBriefOFP } from '@/types/simbrief';
import { BriefingTab, FmsExportSection, NavlogTab, PerformanceTab } from './components';
import { FlightHeader } from './components/FlightHeader';
import { FlightTab } from './components/FlightTab';
import { FuelTab } from './components/FuelTab';
import { WeatherTab } from './components/WeatherTab';
import { WeightsTab } from './components/WeightsTab';

// Helper to get unit from API response
function getApiUnit(data: SimBriefOFP): string {
  return data.params.units;
}

interface SimbriefDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SimbriefDialog({ open, onClose }: SimbriefDialogProps) {
  useTrackFeatureOpened('simbrief', open);
  const { t } = useTranslation();
  const { simbrief } = useSettingsStore();
  // A link can bring its own pilot ID for this dialog session; it is never saved.
  const pilotIdOverride = useFlightPlanStore((s) => s.simbriefPilotIdOverride);
  const autoFetch = useFlightPlanStore((s) => s.simbriefAutoFetch);
  const clearSimbriefAutoFetch = useFlightPlanStore((s) => s.clearSimbriefAutoFetch);
  const pilotId = pilotIdOverride ?? simbrief.pilotId;
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
    if (pilotId) {
      fetchMutation.mutate(pilotId);
    }
  };

  const { mutate: fetchOfp } = fetchMutation;
  useEffect(() => {
    if (!open || !autoFetch) return;
    clearSimbriefAutoFetch();
    if (pilotId) fetchOfp(pilotId);
  }, [open, autoFetch, pilotId, clearSimbriefAutoFetch, fetchOfp]);

  const handleImport = () => {
    if (ofp) {
      loadFromSimbrief(ofp);
      onClose();
    }
  };

  const isConfigured = !!pilotId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        {/* Header with SimBrief branding */}
        <div className="bg-card flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <SimbriefLogo size="md" className="opacity-90" />
            <div>
              <DialogTitle className="text-foreground text-lg font-semibold">
                {t('simbrief.title')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {t('simbrief.description')}
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
                <Spinner className="" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('simbrief.refetch')}
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
              <p className="text-lg font-medium">{t('simbrief.notConfigured')}</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                {t('simbrief.configurePilotId')}
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
                <p className="text-muted-foreground text-sm">{t('simbrief.fetching')}</p>
              </>
            ) : fetchMutation.isError ? (
              <>
                <div className="bg-destructive/10 rounded-full p-4">
                  <AlertCircle className="text-destructive h-12 w-12" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-destructive font-medium">{t('simbrief.fetchError')}</p>
                  <p className="text-muted-foreground text-sm">
                    {describeSimbriefError(fetchMutation.error, t)}
                  </p>
                </div>
                <Button onClick={handleFetch} variant="outline">
                  {t('common.retry')}
                </Button>
              </>
            ) : (
              <>
                <div className="bg-primary/10 rounded-full p-6">
                  <Plane className="text-primary h-16 w-16" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-lg font-medium">{t('simbrief.ready')}</p>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    {t('simbrief.clickToFetch')}
                  </p>
                </div>
                <Button onClick={handleFetch} size="lg" className="gap-2">
                  <SimbriefLogo size="xs" className="brightness-0 invert" />
                  {t('simbrief.fetchLatest')}
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
                    <TabsTrigger value="flight" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <Route className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.flight')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.performance')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="navlog" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <List className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.navlog')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="fuel" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <Fuel className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.fuel')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="weights" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <Scale className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.weights')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="weather" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <Cloud className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.weather')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="briefing" className="min-w-0 flex-1 gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="truncate">{t('simbriefDialog.tabs.briefing')}</span>
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
                {t('common.cancel')}
              </Button>
              {ofp && (
                <Button onClick={handleImport} className="gap-2">
                  <Route className="h-4 w-4" />
                  {t('simbrief.import')}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
