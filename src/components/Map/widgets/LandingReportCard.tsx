import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Copy, Crosshair, PlaneLanding, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  LandingStats,
  landingCardLabels,
  runwayLine,
  thresholdLine,
} from '@/components/dialogs/LogbookDialog/LandingStats';
import { RateScale } from '@/components/flightRecorder/RateScale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RATING_TEXT_CLASS } from '@/lib/flightRecorder/format';
import { copyLandingCard } from '@/lib/flightRecorder/landingCardImage';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import { useMapStore } from '@/stores/mapStore';
import { useDragPosition } from '../hooks/useDragPosition';

const AUTO_HIDE_MS = 45_000;

interface LandingReportCardProps {
  onShowOnMap: (lat: number, lon: number) => void;
}

/** Slides in after touchdown with the numbers pilots argue about. */
export default function LandingReportCard({ onShowOnMap }: LandingReportCardProps) {
  const { t } = useTranslation();
  const landing = useFlightRecorderStore((s) => s.landing);
  const dismiss = useFlightRecorderStore((s) => s.dismissLanding);
  const [hovered, setHovered] = useState(false);
  const cardPosition = useMapStore((s) => s.landingCardPosition);
  const setCardPosition = useMapStore((s) => s.setLandingCardPosition);
  const { stripRef, position, handleMouseDown, handleDoubleClick } = useDragPosition(
    cardPosition,
    setCardPosition
  );

  useEffect(() => {
    if (!landing || hovered) return;
    const remaining = landing.shownAt + AUTO_HIDE_MS - Date.now();
    if (remaining <= 0) {
      dismiss();
      return;
    }
    const timer = setTimeout(dismiss, remaining);
    return () => clearTimeout(timer);
  }, [landing, hovered, dismiss]);

  if (!landing) return null;
  const report = landing.report;
  const ratingColor = RATING_TEXT_CLASS[report.rating];
  const threshold = thresholdLine(t, report);

  const openInLogbook = () => useAppStore.getState().openLogbook('flights', landing.flightId);

  const copyImage = async () => {
    const ok = await copyLandingCard(report, landingCardLabels(t, report));
    if (ok) toast.success(t('logbook.imageCopied'));
    else toast.error(t('logbook.imageCopyFailed'));
  };

  const isDefault = position === null;

  return (
    <div
      ref={stripRef}
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'landing-card-enter border-border/50 bg-card/90 z-20 w-[400px] cursor-grab rounded-xl border shadow-2xl shadow-black/50 backdrop-blur-xl select-none active:cursor-grabbing',
        isDefault ? 'absolute right-4 bottom-4' : 'fixed'
      )}
      style={!isDefault ? { left: position.x, top: position.y } : undefined}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <PlaneLanding className={cn('h-4 w-4', ratingColor)} />
        <span className="text-muted-foreground text-xs tracking-wider uppercase">
          {t('landing.title')}
        </span>
        <span className="text-muted-foreground/70 min-w-0 flex-1 truncate text-xs">
          {runwayLine(t, report)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 h-7 w-7"
          onClick={dismiss}
          tooltip={t('landing.dismiss')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="px-4 pt-2">
        <div className="flex items-baseline gap-2">
          <span className={cn('font-mono text-5xl leading-none font-black', ratingColor)}>
            {report.touchdownRateFpm}
          </span>
          <span className="text-muted-foreground text-sm">{t('units.fpm')}</span>
          <Badge variant="outline" className={cn('ml-auto border-current', ratingColor)}>
            {t(`landing.rating.${report.rating}`)}
          </Badge>
        </div>
        {threshold && <p className="text-muted-foreground mt-1.5 text-xs">{threshold}</p>}
        <RateScale
          touchdownRateFpm={report.touchdownRateFpm}
          rating={report.rating}
          compact
          className="mt-3"
        />
        <LandingStats report={report} className="mt-4" columns={3} />
      </div>

      <div className="border-border/50 mt-3 flex items-center gap-1 border-t px-2 py-1.5">
        <Button size="sm" variant="ghost" onClick={() => onShowOnMap(report.lat, report.lon)}>
          <Crosshair className="mr-1.5 h-3.5 w-3.5" />
          {t('landing.showOnMap')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copyImage()}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {t('logbook.copyImage')}
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={openInLogbook}>
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          {t('logbook.title')}
        </Button>
      </div>
    </div>
  );
}
