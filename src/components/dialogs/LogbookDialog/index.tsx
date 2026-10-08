import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { BookOpen, History, PlaneLanding, Trash2, X } from 'lucide-react';
import {
  FULL_SCREEN_DIALOG,
  FULL_SCREEN_DIALOG_HEADER,
} from '@/components/dialogs/fullScreenDialog';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPanel, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/helpers';
import { useTrackFeatureOpened } from '@/queries';
import { useClearFlights, useFlightsQuery } from '@/queries/useFlightsQuery';
import { type LogbookTab, useAppStore } from '@/stores/appStore';
import { FlightDetailPanel } from './FlightDetailPanel';
import { FlightList } from './FlightList';
import { LaunchHistory } from './LaunchHistory';

export default function LogbookDialog() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.logbook.open);
  useTrackFeatureOpened('logbook', open);
  const tab = useAppStore((s) => s.logbook.tab);
  const flightId = useAppStore((s) => s.logbook.flightId);
  const setLogbookTab = useAppStore((s) => s.setLogbookTab);
  const setLogbookFlight = useAppStore((s) => s.setLogbookFlight);
  const closeLogbook = useAppStore((s) => s.closeLogbook);

  const { data: flights = [] } = useFlightsQuery(open);
  const clearFlights = useClearFlights();

  useEffect(() => {
    if (!open || tab !== 'flights') return;
    if (flightId && !flights.some((f) => f.id === flightId)) setLogbookFlight(null);
    if (!flightId && flights.length > 0) setLogbookFlight(flights[0]!.id);
  }, [open, tab, flights, flightId, setLogbookFlight]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeLogbook()}>
      <DialogPanel
        className={cn(FULL_SCREEN_DIALOG, 'z-[60] flex-col')}
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{t('logbook.title')}</DialogTitle>
        </VisuallyHidden.Root>

        <div className={FULL_SCREEN_DIALOG_HEADER}>
          <div className="flex items-center gap-3">
            <BookOpen className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">{t('logbook.title')}</span>
            <Tabs value={tab} onValueChange={(v) => setLogbookTab(v as LogbookTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="flights" className="h-6 gap-1.5 text-xs">
                  <PlaneLanding className="h-3.5 w-3.5" />
                  {t('logbook.tabs.flights')}
                </TabsTrigger>
                <TabsTrigger value="launches" className="h-6 gap-1.5 text-xs">
                  <History className="h-3.5 w-3.5" />
                  {t('logbook.tabs.launches')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'flights' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DesktopOnly>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={flights.length === 0}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('logbook.clearAll')}
                    </Button>
                  </DesktopOnly>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('logbook.confirmClearAll')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('logbook.confirmClearAllHint')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearFlights.mutate()}>
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeLogbook}
              className="h-8 w-8"
              tooltip={t('common.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {tab === 'launches' ? (
          <div className="min-h-0 flex-1">
            <LaunchHistory />
          </div>
        ) : flights.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
            <PlaneLanding className="text-muted-foreground/40 h-10 w-10" />
            <p className="text-muted-foreground text-sm">{t('logbook.empty')}</p>
            <p className="text-muted-foreground/60 max-w-md text-xs">{t('logbook.emptyHint')}</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <ScrollArea className="border-border/50 w-[380px] flex-shrink-0 border-r">
              <FlightList flights={flights} selectedId={flightId} onSelect={setLogbookFlight} />
            </ScrollArea>
            <div className="min-w-0 flex-1">
              {flightId ? (
                <FlightDetailPanel flightId={flightId} onDeleted={() => setLogbookFlight(null)} />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  {t('logbook.selectFlight')}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogPanel>
    </Dialog>
  );
}
