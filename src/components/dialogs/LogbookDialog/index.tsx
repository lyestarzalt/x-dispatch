import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { BookOpen, History, PlaneLanding, Trash2, X } from 'lucide-react';
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
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClearFlights, useFlightsQuery } from '@/queries/useFlightsQuery';
import { type LogbookTab, useAppStore } from '@/stores/appStore';
import { FlightDetailPanel } from './FlightDetailPanel';
import { FlightList } from './FlightList';
import { LaunchHistory } from './LaunchHistory';

export default function LogbookDialog() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.logbook.open);
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
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-6 z-[60] flex flex-col rounded-lg border border-border bg-background shadow-xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{t('logbook.title')}</DialogTitle>
          </VisuallyHidden.Root>

          <div className="flex h-11 flex-shrink-0 items-center justify-between rounded-t-lg border-b border-border bg-card px-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
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
              {tab === 'flights' && flights.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {t('logbook.clearAll')}
                    </Button>
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
              <PlaneLanding className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('logbook.empty')}</p>
              <p className="max-w-md text-xs text-muted-foreground/60">{t('logbook.emptyHint')}</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <ScrollArea className="w-[380px] flex-shrink-0 border-r border-border/50">
                <FlightList flights={flights} selectedId={flightId} onSelect={setLogbookFlight} />
              </ScrollArea>
              <div className="min-w-0 flex-1">
                {flightId ? (
                  <FlightDetailPanel flightId={flightId} onDeleted={() => setLogbookFlight(null)} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t('logbook.selectFlight')}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
