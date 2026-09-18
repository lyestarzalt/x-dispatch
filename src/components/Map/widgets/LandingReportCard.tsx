import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Copy, Crosshair, PlaneLanding, X } from 'lucide-react';
import { toast } from 'sonner';
import { landingCardLabels, runwayLine } from '@/components/dialogs/LogbookDialog/LandingStats';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RATING_TEXT_CLASS } from '@/lib/flightRecorder/format';
import { copyLandingCard } from '@/lib/flightRecorder/landingCardImage';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import { DataBlock, GroupSeparator } from './FlightStrip';

const AUTO_HIDE_MS = 45_000;

interface LandingReportCardProps {
  onShowOnMap: (lat: number, lon: number) => void;
}

/** Same strip language as the flight strip above it, one row per landing. */
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
  const ratingColor = RATING_TEXT_CLASS[report.rating];

  const openInLogbook = () => useAppStore.getState().openLogbook('flights', landing.flightId);

  const copyImage = async () => {
    const ok = await copyLandingCard(report, landingCardLabels(t, report));
    if (ok) toast.success(t('logbook.imageCopied'));
    else toast.error(t('logbook.imageCopyFailed'));
  };

  const runway = report.runway;
  const bounceColor = report.bounces > 0 ? 'text-warning' : undefined;

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="landing-card-enter flex select-none items-center rounded-xl border border-border/50 bg-card/90 shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <PlaneLanding className={cn('h-3.5 w-3.5', ratingColor)} />
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('landing.title')}
          </span>
          <span className="max-w-[180px] truncate text-xs text-foreground">
            {runwayLine(t, report)}
          </span>
        </div>
      </div>

      <GroupSeparator />

      <div className="flex items-center gap-3 px-3 py-1.5">
        <div className="flex flex-col items-center">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('landing.touchdownRate')}
          </span>
          <div className="flex items-baseline gap-0.5">
            <span className={cn('font-mono text-xl font-semibold tabular-nums', ratingColor)}>
              {report.touchdownRateFpm}
            </span>
            <span className="text-xs text-muted-foreground">{t('units.fpm')}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn('border-current font-medium', ratingColor)}>
          {t(`landing.rating.${report.rating}`)}
        </Badge>
      </div>

      <GroupSeparator />

      <div className="flex items-center gap-3 px-3 py-1.5">
        <DataBlock
          label={t('landing.peakG')}
          value={report.peakG.toFixed(2)}
          unit={t('landing.gUnit')}
        />
        <DataBlock label={t('landing.pitch')} value={report.pitchDeg.toFixed(1)} unit="°" />
        <DataBlock
          label={t('landing.float')}
          value={report.floatSec.toFixed(1)}
          unit={t('units.s')}
        />
        <DataBlock
          label={t('landing.bounces')}
          value={String(report.bounces)}
          unit=""
          valueColor={bounceColor}
        />
        {runway && (
          <>
            <DataBlock
              label={t('landing.pastThresholdLabel')}
              value={String(Math.round(runway.distancePastThresholdM))}
              unit={t('units.m')}
            />
            <DataBlock
              label={t('landing.centerlineLabel')}
              value={`${Math.abs(runway.centerlineOffsetM).toFixed(1)} ${
                runway.centerlineOffsetM >= 0 ? t('landing.right') : t('landing.left')
              }`}
              unit={t('units.m')}
            />
          </>
        )}
      </div>

      <GroupSeparator />

      <div className="flex items-center gap-0.5 px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onShowOnMap(report.lat, report.lon)}
          tooltip={t('landing.showOnMap')}
        >
          <Crosshair className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => void copyImage()}
          tooltip={t('logbook.copyImage')}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={openInLogbook}
          tooltip={t('logbook.title')}
        >
          <BookOpen className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={dismiss}
          tooltip={t('landing.dismiss')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
