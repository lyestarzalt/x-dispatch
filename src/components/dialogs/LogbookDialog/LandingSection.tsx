import { useTranslation } from 'react-i18next';
import { RateScale } from '@/components/flightRecorder/RateScale';
import { Badge } from '@/components/ui/badge';
import { RATING_TEXT_CLASS } from '@/lib/flightRecorder/format';
import { cn } from '@/lib/utils/helpers';
import type { FlightDetail } from '@/types/flightRecorder';
import { LandingStats, runwayLine, thresholdLine } from './LandingStats';

interface LandingSectionProps {
  flight: FlightDetail;
}

export function LandingSection({ flight }: LandingSectionProps) {
  const { t } = useTranslation();
  const landing = flight.landing;

  if (!landing) {
    return (
      <section className="rounded-lg border border-border/50 bg-card/60 p-4">
        <h3 className="xp-section-heading mb-2">{t('landing.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('logbook.noLanding')}</p>
      </section>
    );
  }

  const ratingColor = RATING_TEXT_CLASS[landing.rating];
  const threshold = thresholdLine(t, landing);
  const earlierRates = flight.landings
    .slice(0, -1)
    .map((l) => `${l.touchdownRateFpm}`)
    .join(', ');
  const bounceRates = landing.bounceRatesFpm.map((r) => `${r}`).join(', ');

  return (
    <section className="rounded-lg border border-border/50 bg-card/60 p-4">
      <h3 className="xp-section-heading mb-3">{t('landing.title')}</h3>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn('font-mono text-5xl font-black leading-none', ratingColor)}>
              {landing.touchdownRateFpm}
            </span>
            <span className="text-sm text-muted-foreground">{t('units.fpm')}</span>
            <Badge variant="outline" className={cn('ml-2 border-current', ratingColor)}>
              {t(`landing.rating.${landing.rating}`)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-foreground">{runwayLine(t, landing)}</p>
          {threshold && <p className="text-xs text-muted-foreground">{threshold}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="xp-label">{t('landing.indicatedRate')}</p>
          <p className="font-mono text-sm">
            {landing.indicatedRateFpm} {t('units.fpm')}
          </p>
        </div>
      </div>

      <RateScale
        touchdownRateFpm={landing.touchdownRateFpm}
        rating={landing.rating}
        className="mt-4"
      />

      <LandingStats report={landing} className="mt-4" columns={4} />

      {bounceRates && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('landing.bounceContacts', { rates: bounceRates })}
        </p>
      )}
      {earlierRates && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('logbook.earlierLandings', { rates: earlierRates })}
        </p>
      )}
    </section>
  );
}
