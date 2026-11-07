import { useTranslation } from 'react-i18next';
import { MoveHorizontal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnits } from '@/hooks/useUnits';
import { WIDTH_CODE_WINGSPAN_M } from '@/lib/airports/standIdentity';
import { metersToFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';

/**
 * The tighter of two stand codes, for a city pair: the aircraft has to fit at
 * both ends. Unknown at either end means unknown for the pair.
 */
export function smallerStandCode(a: string | undefined, b: string | undefined): string | undefined {
  if (!a || !b) return undefined;
  return a < b ? a : b;
}

interface GateSizeTagProps {
  /** ICAO aerodrome reference code letter (A–F) of the widest stand. */
  code: string | undefined;
  /** The code is the tighter end of a city pair, and the tooltip says so. */
  forRoute?: boolean;
  className?: string;
}

/**
 * The wingspan the airport's widest stand takes, so a list of airports tells
 * at a glance which ones can park the aircraft. Renders nothing without a size.
 */
export function GateSizeTag({ code, forRoute = false, className }: GateSizeTagProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const wingspanM = code ? WIDTH_CODE_WINGSPAN_M[code] : undefined;
  if (wingspanM === undefined) return null;

  const span = units.shortDistance(metersToFeet(wingspanM));
  const label = forRoute ? t('explore.gateSizeRoute', { span }) : t('explore.gateSize', { span });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'text-muted-foreground text-2xs inline-flex shrink-0 items-center gap-0.5 font-mono tabular-nums',
            className
          )}
          aria-label={label}
        >
          <MoveHorizontal className="h-3 w-3" aria-hidden />
          {span}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
