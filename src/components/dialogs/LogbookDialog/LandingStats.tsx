import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { LandingCardLabels } from '@/lib/flightRecorder/landingCardImage';
import { cn } from '@/lib/utils/helpers';
import type { LandingReport } from '@/types/flightRecorder';

export function runwayLine(t: TFunction, report: LandingReport): string {
  if (!report.runway) return t('landing.unknownRunway');
  return t('landing.runway', { icao: report.runway.icao, runway: report.runway.runway });
}

export function thresholdLine(t: TFunction, report: LandingReport): string | null {
  const runway = report.runway;
  if (!runway) return null;
  const along =
    runway.distancePastThresholdM >= 0
      ? t('landing.pastThreshold', { m: Math.round(runway.distancePastThresholdM) })
      : t('landing.shortOfThreshold', { m: Math.round(-runway.distancePastThresholdM) });
  const side = runway.centerlineOffsetM >= 0 ? t('landing.right') : t('landing.left');
  const offset = t('landing.centerlineOffset', {
    m: Math.abs(runway.centerlineOffsetM).toFixed(1),
    side,
  });
  return `${along} · ${offset}`;
}

export interface StatCell {
  label: string;
  value: string;
}

export function landingStatCells(t: TFunction, report: LandingReport): StatCell[] {
  const cells: StatCell[] = [
    { label: t('landing.peakG'), value: `${report.peakG.toFixed(2)} g` },
    { label: t('landing.pitch'), value: `${report.pitchDeg.toFixed(1)}°` },
    { label: t('landing.flareLabel'), value: t(`landing.flare.${report.flare}`) },
    { label: t('landing.float'), value: `${report.floatSec.toFixed(1)} ${t('units.s')}` },
    { label: t('landing.bounces'), value: String(report.bounces) },
  ];
  if (report.runway) {
    cells.push({
      label: t('landing.pastThresholdLabel'),
      value: `${Math.round(report.runway.distancePastThresholdM)} ${t('units.m')}`,
    });
    cells.push({
      label: t('landing.centerlineLabel'),
      value: `${Math.abs(report.runway.centerlineOffsetM).toFixed(1)} ${t('units.m')} ${
        report.runway.centerlineOffsetM >= 0 ? t('landing.right') : t('landing.left')
      }`,
    });
  } else if (report.noseRateDegSec !== null) {
    cells.push({
      label: t('landing.noseRate'),
      value: `${report.noseRateDegSec.toFixed(1)}°/s`,
    });
  }
  return cells;
}

export function landingCardLabels(t: TFunction, report: LandingReport): LandingCardLabels {
  return {
    title: t('landing.title'),
    rating: t(`landing.rating.${report.rating}`),
    runway: runwayLine(t, report),
    stats: landingStatCells(t, report),
    footer: t('landing.cardFooter'),
  };
}

interface LandingStatsProps {
  report: LandingReport;
  className?: string;
  columns?: 2 | 3 | 4;
}

export function LandingStats({ report, className, columns = 3 }: LandingStatsProps) {
  const { t } = useTranslation();
  const cells = landingStatCells(t, report);
  return (
    <dl
      className={cn(
        'grid gap-x-4 gap-y-2',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-4',
        className
      )}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0">
          <dt className="xp-label truncate">{cell.label}</dt>
          <dd className="text-foreground truncate font-mono text-sm">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}
