import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type NatDirection, validityLabel } from '@/lib/flightplan/builder/trackChoice';
import type { NatMessageInfo, NatMessageStatus } from '@/lib/flightplan/builder/types';
import { Caption } from './TrackCaption';

const STATUS_KEY: Record<NatMessageStatus, string> = {
  current: 'planBuilder.tracks.current',
  upcoming: 'planBuilder.tracks.upcoming',
  expired: 'planBuilder.tracks.lastPublished',
};

/**
 * The header line of a track set: its status, window and TMI, with the remarks behind an
 * info button. A set that has ended says so, and explains on hover when the next one is due.
 */
export function MessageCaption({
  message,
  direction,
}: {
  message: NatMessageInfo;
  direction: NatDirection;
}) {
  const { t } = useTranslation();
  const label = <Caption>{t(STATUS_KEY[message.status])}</Caption>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {message.status === 'expired' ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 underline decoration-dotted underline-offset-4">
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            {direction === 'eastbound'
              ? t('planBuilder.tracks.nextSet.eastbound')
              : t('planBuilder.tracks.nextSet.westbound')}
          </TooltipContent>
        </Tooltip>
      ) : (
        label
      )}
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {validityLabel(message.validFrom, message.validTo)}
      </span>
      {message.tmi !== null && (
        <Badge variant="outline" className="shrink-0 px-1.5 py-0 font-mono">
          {t('planBuilder.tracks.tmi', { tmi: message.tmi })}
        </Badge>
      )}
      {message.remarks && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label={t('planBuilder.tracks.remarks')}
              title={t('planBuilder.tracks.remarks')}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96">
            <Caption className="mb-2 block">{t('planBuilder.tracks.remarks')}</Caption>
            <pre className="max-h-64 overflow-y-auto font-mono text-xs leading-5 whitespace-pre-wrap">
              {message.remarks}
            </pre>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
