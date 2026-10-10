import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Cloud,
  ExternalLink,
  Fuel,
  Plane,
  RefreshCw,
  Route,
  Settings,
  X,
  Zap,
} from 'lucide-react';
import { SimbriefLogo } from '@/components/ui/SimbriefLogo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { describeSimbriefError } from '@/lib/simbrief/fetchError';
import { parseTimestamp } from '@/lib/simbrief/ofp';
import { formatRelativeTime } from '@/lib/utils/format/relativeTime';
import { cn } from '@/lib/utils/helpers';
import { useTrackFeatureOpened } from '@/queries';
import { useSimbriefFetch } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { FULL_SCREEN_DIALOG, FULL_SCREEN_DIALOG_HEADER } from '../fullScreenDialog';
import { DispatchHeader } from './components/DispatchHeader';
import { FmsExportMenu } from './components/FmsExportMenu';
import { FuelWeightsTab } from './components/FuelWeightsTab';
import { PerformanceTab } from './components/PerformanceTab';
import { RouteTab } from './components/RouteTab';
import { WeatherTab } from './components/WeatherTab';

interface SimbriefDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SimbriefDialog({ open, onClose }: SimbriefDialogProps) {
  useTrackFeatureOpened('simbrief', open);
  const { t, i18n } = useTranslation();
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
  const apiUnit = ofp?.params.units ?? 'lbs';
  const imported = !!ofp && simbriefData?.params.request_id === ofp.params.request_id;
  const generated = ofp ? parseTimestamp(ofp.params.time_generated) : null;

  const handleOpenPDF = () => {
    if (ofp?.files.pdf.link) {
      window.appAPI.openExternal(ofp.files.directory + ofp.files.pdf.link);
    }
  };

  const handleFetch = () => {
    if (pilotId) fetchMutation.mutate(pilotId);
  };

  const { mutate: fetchOfp } = fetchMutation;
  useEffect(() => {
    if (!open || !autoFetch) return;
    clearSimbriefAutoFetch();
    if (pilotId) fetchOfp(pilotId);
  }, [open, autoFetch, pilotId, clearSimbriefAutoFetch, fetchOfp]);

  // Settings opens on the SimBrief tab; this dialog closes first so the two never stack.
  const handleOpenSettings = () => {
    onClose();
    useAppStore.getState().openSettings('simbrief');
  };

  const handleImport = () => {
    if (ofp) {
      loadFromSimbrief(ofp);
      onClose();
    }
  };

  const isConfigured = !!pilotId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPanel className={cn(FULL_SCREEN_DIALOG, 'mx-auto max-w-5xl flex-col')}>
        {/* Title row: who the plan comes from, how fresh it is */}
        <div className={FULL_SCREEN_DIALOG_HEADER}>
          <div className="flex min-w-0 items-center gap-4">
            <SimbriefLogo size="md" />
            <DialogTitle className="truncate text-sm font-medium">
              {t('simbrief.title')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('simbrief.description')}</DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {ofp && (
              <>
                <p className="text-muted-foreground text-xs">
                  {generated
                    ? t('simbriefDialog.header.generated', {
                        time: generated.toISOString().slice(11, 16) + 'Z',
                        ago: formatRelativeTime(generated, i18n.language),
                      })
                    : t('simbriefDialog.header.airac', { cycle: ofp.params.airac })}
                  {generated && <span className="text-border mx-2">|</span>}
                  {generated && t('simbriefDialog.header.airac', { cycle: ofp.params.airac })}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFetch}
                  disabled={fetchMutation.isPending}
                  className="text-muted-foreground hover:text-foreground gap-2"
                >
                  {fetchMutation.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
                  {t('simbrief.refetch')}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              tooltip={t('common.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Not Configured State */}
        {!isConfigured && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
            <div className="bg-warning/10 rounded-full p-4">
              <AlertCircle className="text-warning h-12 w-12" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium">{t('simbrief.notConfigured')}</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                {t('simbrief.configurePilotId')}
              </p>
            </div>
            <Button onClick={handleOpenSettings} size="lg" className="gap-2">
              <Settings className="h-4 w-4" />
              {t('simbriefDialog.actions.openSettings')}
            </Button>
          </div>
        )}

        {/* Configured - Fetch UI */}
        {isConfigured && !ofp && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
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

        {ofp && (
          <>
            <DispatchHeader
              data={ofp}
              apiUnit={apiUnit}
              imported={imported}
              onImport={handleImport}
              onAirportClick={onClose}
            />

            <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
              <Tabs defaultValue="route" className="flex min-h-0 flex-1 flex-col">
                <TabsList variant="line" className="mb-4 shrink-0">
                  <TabsTrigger value="route" className="min-w-0 flex-1 gap-1.5 text-xs">
                    <Route className="h-3.5 w-3.5" />
                    <span className="truncate">{t('simbriefDialog.tabs.route')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="fuel" className="min-w-0 flex-1 gap-1.5 text-xs">
                    <Fuel className="h-3.5 w-3.5" />
                    <span className="truncate">{t('simbriefDialog.tabs.fuelWeights')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="min-w-0 flex-1 gap-1.5 text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="truncate">{t('simbriefDialog.tabs.performance')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="weather" className="min-w-0 flex-1 gap-1.5 text-xs">
                    <Cloud className="h-3.5 w-3.5" />
                    <span className="truncate">{t('simbriefDialog.tabs.weather')}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="route" className="mt-0 flex min-h-0 flex-1 flex-col">
                  <RouteTab data={ofp} apiUnit={apiUnit} />
                </TabsContent>
                <TabsContent value="fuel" className="mt-0 min-h-0 flex-1">
                  <ScrollArea className="h-full">
                    <FuelWeightsTab data={ofp} apiUnit={apiUnit} />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="performance" className="mt-0 min-h-0 flex-1">
                  <ScrollArea className="h-full">
                    <PerformanceTab data={ofp} />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="weather" className="mt-0 min-h-0 flex-1">
                  <ScrollArea className="h-full">
                    <WeatherTab data={ofp} />
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="bg-muted/30 border-t px-6 py-3">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenPDF}
                    className="text-muted-foreground gap-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('simbriefDialog.actions.openPdf')}
                  </Button>
                  <FmsExportMenu data={ofp} onOpenSettings={onClose} />
                </div>
                <Button variant="outline" size="sm" onClick={onClose}>
                  {t('common.close')}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogPanel>
    </Dialog>
  );
}
