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
import { Button } from '@/components/ui/button';
import { RATING_BORDER_CLASS, RATING_TEXT_CLASS } from '@/lib/flightRecorder/format';
import { copyLandingCard } from '@/lib/flightRecorder/landingCardImage';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';

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

  const openInLogbook = () => useAppStore.getState().openLogbook('flights', landing.flightId);

  const copyImage = async () => {
    const ok = await copyLandingCard(report, landingCardLabels(t, report));
    if (ok) toast.success(t('logbook.imageCopied'));
    else toast.error(t('logbook.imageCopyFailed'));
  };

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'landing-card-enter w-[380px] rounded-xl border bg-background/90 p-4 shadow-2xl backdrop-blur-md',
        RATING_BORDER_CLASS[report.rating]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <PlaneLanding className="h-4 w-4" />
          {t('landing.title')}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 h-7 w-7"
          onClick={dismiss}
          tooltip={t('landing.dismiss')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            'font-mono text-5xl font-black leading-none',
            RATING_TEXT_CLASS[report.rating]
          )}
        >
          {report.touchdownRateFpm}
        </span>
        <span className="text-sm text-muted-foreground">{t('units.fpm')}</span>
      </div>
      <div className={cn('mt-1 text-lg font-semibold', RATING_TEXT_CLASS[report.rating])}>
        {t(`landing.rating.${report.rating}`)}
      </div>
      <p className="text-sm text-muted-foreground">{runwayLine(t, report)}</p>
      {thresholdLine(t, report) && (
        <p className="text-xs text-muted-foreground/80">{thresholdLine(t, report)}</p>
      )}

      <LandingStats report={report} className="mt-3" columns={3} />

      <div className="mt-3 flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={() => onShowOnMap(report.lat, report.lon)}>
          <Crosshair className="mr-1.5 h-3.5 w-3.5" />
          {t('landing.showOnMap')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copyImage()}>
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
