import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Copy, Crosshair, PlaneLanding, X } from 'lucide-react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
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
import { cardSpring, exitEase } from '@/lib/motionPresets';
import { cn } from '@/lib/utils/helpers';
import { toastError } from '@/lib/utils/toastError';
import { useAppStore } from '@/stores/appStore';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import { useMapStore } from '@/stores/mapStore';
import { useDragPosition } from '../hooks/useDragPosition';

const AUTO_HIDE_MS = 45_000;
const COUNT_UP_S = 0.8;

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
  const reducedMotion = useReducedMotion();
  const fpmRef = useRef<HTMLSpanElement>(null);
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

  // Count-up writes to the DOM node directly so no React render runs per frame.
  const fpm = landing?.report.touchdownRateFpm;
  const shownAt = landing?.shownAt;
  useEffect(() => {
    const el = fpmRef.current;
    if (!el || fpm === undefined || reducedMotion) return;
    const controls = animate(0, fpm, {
      duration: COUNT_UP_S,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [shownAt, fpm, reducedMotion]);

  const report = landing?.report;
  const threshold = report ? thresholdLine(t, report) : null;
  const isDefault = position === null;

  const openInLogbook = () => {
    if (landing) useAppStore.getState().openLogbook('flights', landing.flightId);
  };

  const copyImage = async () => {
    if (!report) return;
    const ok = await copyLandingCard(report, landingCardLabels(t, report));
    if (ok) toast.success(t('logbook.imageCopied'));
    else toastError('landing_report', t('logbook.imageCopyFailed'));
  };

  return (
    <AnimatePresence>
      {landing && report && (
        <motion.div
          key={landing.shownAt}
          ref={stripRef}
          role="status"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98, transition: exitEase }}
          transition={cardSpring}
          className={cn(
            'border-border/50 bg-card/90 z-20 w-[400px] cursor-grab rounded-xl border shadow-xl backdrop-blur-xl select-none active:cursor-grabbing',
            isDefault ? 'absolute right-4 bottom-4' : 'fixed'
          )}
          style={!isDefault ? { left: position.x, top: position.y } : undefined}
        >
          <div className="flex items-center gap-2 px-4 pt-3">
            <PlaneLanding className={cn('h-4 w-4', RATING_TEXT_CLASS[report.rating])} />
            <span className="text-muted-foreground text-xs tracking-wider uppercase">
              {t('landing.title')}
            </span>
            <span className="text-muted-foreground/70 min-w-0 flex-1 truncate text-xs">
              {runwayLine(t, report)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-2"
              onClick={dismiss}
              tooltip={t('landing.dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="px-4 pt-2">
            <div className="flex items-baseline gap-2">
              <span
                ref={fpmRef}
                className={cn(
                  'font-mono text-5xl leading-none font-black',
                  RATING_TEXT_CLASS[report.rating]
                )}
              >
                {reducedMotion ? report.touchdownRateFpm : 0}
              </span>
              <span className="text-muted-foreground text-sm">{t('units.fpm')}</span>
              <Badge
                variant="outline"
                className={cn('ml-auto border-current', RATING_TEXT_CLASS[report.rating])}
              >
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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...cardSpring, delay: 0.2 }}
            >
              <LandingStats report={report} className="mt-4" columns={3} />
            </motion.div>
          </div>

          <div className="border-border/50 mt-3 flex items-center gap-1 border-t px-2 py-1.5">
            <Button size="sm" variant="ghost" onClick={() => onShowOnMap(report.lat, report.lon)}>
              <Crosshair className="h-3.5 w-3.5" />
              {t('landing.showOnMap')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void copyImage()}>
              <Copy className="h-3.5 w-3.5" />
              {t('logbook.copyImage')}
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={openInLogbook}>
              <BookOpen className="h-3.5 w-3.5" />
              {t('logbook.title')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
