import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { validityLabel } from '@/lib/flightplan/builder/trackChoice';
import type { NatMessageInfo } from '@/lib/flightplan/builder/types';
import { Caption } from './TrackCaption';

export function MessageCaption({
  message,
  upcoming,
}: {
  message: NatMessageInfo;
  upcoming: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Caption>
        {upcoming ? t('planBuilder.tracks.upcoming') : t('planBuilder.tracks.current')}
      </Caption>
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
