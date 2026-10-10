import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLevel } from '@/lib/flightplan/builder/formatLevel';
import type { LevelBand, RouteToken } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';

/** "FL245 to FL460", "from FL245" or "up to FL460", for an airway's published band. */
function levelsText(t: TFunction, band: LevelBand): string {
  const min = formatLevel(band.minFt);
  const max = formatLevel(band.maxFt);
  if (band.minFt !== null && band.maxFt !== null)
    return t('planBuilder.levelsBetween', { min, max });
  if (band.minFt !== null) return t('planBuilder.levelsFrom', { min });
  return t('planBuilder.levelsUpTo', { max });
}

/**
 * A route token the resolver could not use, or used with a warning, with the reason in plain
 * sight rather than on hover.
 */
export function RouteProblem({ token, onRemove }: { token: RouteToken; onRemove: () => void }) {
  const { t } = useTranslation();
  const issue = token.issue ?? (token.status === 'unknown' ? 'notFound' : undefined);
  const detail =
    issue === 'airwayLevel' && token.levels
      ? t('planBuilder.issues.airwayLevel', { levels: levelsText(t, token.levels) })
      : issue
        ? t(`planBuilder.issues.${issue}`)
        : null;
  return (
    <li className="flex min-w-0 items-start gap-2 text-xs">
      <span
        className={cn(
          'shrink-0 rounded-sm border px-1.5 py-0.5 font-mono',
          token.status === 'unknown' || token.status === 'warning'
            ? 'border-warning/40 bg-warning/10 text-warning'
            : 'border-destructive/40 bg-destructive/10 text-destructive'
        )}
      >
        {token.text}
      </span>
      {detail && <span className="text-muted-foreground min-w-0 flex-1 pt-0.5">{detail}</span>}
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground ml-auto shrink-0"
        onClick={onRemove}
        tooltip={t('planBuilder.removeToken', { token: token.text })}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
