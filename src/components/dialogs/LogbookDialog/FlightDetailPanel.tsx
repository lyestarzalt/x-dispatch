import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Copy, Map as MapIcon, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { formatDateTime, formatDuration } from '@/lib/flightRecorder/format';
import { copyLandingCard } from '@/lib/flightRecorder/landingCardImage';
import { useDeleteFlight, useFlightDetailQuery } from '@/queries/useFlightsQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import type { FlightDetail } from '@/types/flightRecorder';
import { LandingSection } from './LandingSection';
import { landingCardLabels } from './LandingStats';
import { TrailThumbnail } from './TrailThumbnail';

interface FlightDetailPanelProps {
  flightId: string;
  onDeleted: () => void;
}

export function FlightDetailPanel({ flightId, onDeleted }: FlightDetailPanelProps) {
  const { t } = useTranslation();
  const { data: flight, isLoading } = useFlightDetailQuery(flightId);

  if (isLoading || !flight) {
    return (
      <div className="flex h-full items-center justify-center">
        {isLoading ? (
          <Spinner />
        ) : (
          <p className="text-muted-foreground text-sm">{t('logbook.selectFlight')}</p>
        )}
      </div>
    );
  }

  return <FlightDetailBody flight={flight} onDeleted={onDeleted} />;
}

function FlightDetailBody({ flight, onDeleted }: { flight: FlightDetail; onDeleted: () => void }) {
  const { t, i18n } = useTranslation();
  const deleteFlight = useDeleteFlight();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const landing = flight.landing;
  const fuelBurned =
    flight.fuelStartKg !== null && flight.fuelEndKg !== null
      ? Math.max(0, flight.fuelStartKg - flight.fuelEndKg)
      : null;

  const airportNames = [flight.departure?.name, flight.arrival?.name].filter(Boolean).join(' → ');

  const openOnMap = (playing: boolean) => {
    useFlightRecorderStore.getState().startReplay(flight, { playing });
    useAppStore.getState().closeLogbook();
  };

  const copyImage = async () => {
    if (!landing) return;
    const ok = await copyLandingCard(landing, landingCardLabels(t, landing));
    if (ok) toast.success(t('logbook.imageCopied'));
    else toast.error(t('logbook.imageCopyFailed'));
  };

  const stats: Array<{ label: string; value: string }> = [
    { label: t('logbook.blockTime'), value: formatDuration(flight.blockTimeSec) },
    { label: t('logbook.airTime'), value: formatDuration(flight.airTimeSec) },
    { label: t('logbook.distance'), value: `${Math.round(flight.distanceNm)} ${t('units.nm')}` },
    {
      label: t('logbook.maxAltitude'),
      value: `${flight.maxAltFt.toLocaleString(i18n.language)} ${t('units.ft')}`,
    },
    { label: t('logbook.maxSpeed'), value: `${flight.maxGroundspeedKt} ${t('units.kt')}` },
    {
      label: t('logbook.fuelBurned'),
      value: fuelBurned === null ? '—' : `${Math.round(fuelBurned)} ${t('units.kg')}`,
    },
    { label: t('logbook.landings'), value: String(flight.landingCount) },
    { label: t('logbook.points'), value: flight.pointCount.toLocaleString(i18n.language) },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-5">
        <div className="flex items-start gap-4">
          <TrailThumbnail
            preview={flight.preview}
            width={140}
            height={84}
            className="text-sky-300"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-2xl font-bold">
              <span>{flight.departure?.icao ?? '----'}</span>
              <ArrowRight className="text-muted-foreground h-5 w-5" />
              <span>{flight.arrival?.icao ?? '----'}</span>
            </div>
            <p className="text-muted-foreground truncate text-sm">
              {airportNames || t('logbook.unknownAirport')}
            </p>
            <p className="mt-1 text-sm">
              {flight.aircraft.name ?? flight.aircraft.icao ?? t('logbook.unknownAircraft')}
              {flight.aircraft.livery && (
                <span className="text-muted-foreground"> · {flight.aircraft.livery}</span>
              )}
            </p>
            <p className="text-muted-foreground/70 text-xs">
              {formatDateTime(flight.startedAt, i18n.language)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => openOnMap(false)}>
            <MapIcon className="mr-1.5 h-4 w-4" />
            {t('logbook.showOnMap')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openOnMap(true)}>
            <Play className="mr-1.5 h-4 w-4" />
            {t('logbook.replay')}
          </Button>
          {landing && (
            <Button size="sm" variant="outline" onClick={() => void copyImage()}>
              <Copy className="mr-1.5 h-4 w-4" />
              {t('logbook.copyImage')}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t('logbook.delete')}
          </Button>
        </div>

        <dl className="border-border/50 bg-card/60 grid grid-cols-4 gap-x-4 gap-y-3 rounded-lg border p-4">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="xp-label truncate">{stat.label}</dt>
              <dd className="truncate font-mono text-sm">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <LandingSection flight={flight} />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logbook.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('logbook.confirmDeleteHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteFlight.mutate(flight.id, { onSuccess: onDeleted });
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
