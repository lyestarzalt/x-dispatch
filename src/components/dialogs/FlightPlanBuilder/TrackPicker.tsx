import { useTranslation } from 'react-i18next';
import { Waves } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type NatDirection, messagesForDirection } from '@/lib/flightplan/builder/trackChoice';
import type { NatFeed, NatMessageInfo, RouteIssue } from '@/lib/flightplan/builder/types';
import { MessageCaption } from './MessageCaption';
import { Caption } from './TrackCaption';
import { TrackChips } from './TrackChips';
import { TrackDetail } from './TrackDetail';

interface TrackPickerProps {
  feed: NatFeed | undefined;
  direction: NatDirection;
  /** Designator filed in the route ("NATA"), or null when the router chose freely. */
  selected: string | null;
  cruiseAltitudeFt: number | null;
  /** Resolver warnings on the route, shown beside the track warnings. */
  issues: RouteIssue[];
  disabled?: boolean;
  /** A designator to route through, or null to let the router choose again. */
  onPick: (track: string | null) => void;
}

/**
 * The North Atlantic tracks offered for the crossing, laid out like a track message: the
 * set valid now with its TMI and window, the upcoming set below it, one chip per track with
 * its level band, and the chosen track's fix string, levels, NARs and feeder fixes. While
 * nothing is valid or upcoming, the last published set stands in as a suggestion.
 */
export function TrackPicker({
  feed,
  direction,
  selected,
  cruiseAltitudeFt,
  issues,
  disabled,
  onPick,
}: TrackPickerProps) {
  const { t } = useTranslation();
  const { current, upcoming, expired } = messagesForDirection(feed, direction);
  // The last published set stands in only while nothing is valid or upcoming.
  const shown = current || upcoming ? [current, upcoming] : [expired];
  const sets = shown.filter((m): m is NatMessageInfo => m !== null);
  const chosen = selected
    ? (sets.flatMap((m) =>
        m.tracks.filter((tr) => tr.name === selected).map((track) => ({ track, status: m.status }))
      )[0] ?? null)
    : null;
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 items-center gap-2">
              <Waves className="text-muted-foreground h-4 w-4 shrink-0" />
              <Caption className="underline decoration-dotted underline-offset-4">
                {t('planBuilder.tracks.title')}
              </Caption>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{t('planBuilder.tracks.hint')}</TooltipContent>
        </Tooltip>
        <span className="text-muted-foreground shrink-0 text-xs">
          {t(`planBuilder.tracks.${direction}`)}
        </span>
        {disabled && <Spinner className="text-muted-foreground size-4 shrink-0" />}
      </div>
      {sets.length === 0 && (
        <p className="text-muted-foreground text-xs">
          {feed?.error && feed.messages.length === 0
            ? t('planBuilder.tracks.unavailable', { reason: feed.error })
            : direction === 'eastbound'
              ? t('planBuilder.tracks.none.eastbound')
              : t('planBuilder.tracks.none.westbound')}
        </p>
      )}
      {sets.map((message, index) => (
        <div key={`${message.origin}|${message.validFrom}`} className="space-y-1.5">
          <MessageCaption message={message} direction={direction} />
          <TrackChips
            tracks={message.tracks}
            selected={selected}
            cruiseAltitudeFt={cruiseAltitudeFt}
            disabled={disabled}
            withAuto={index === 0}
            onPick={onPick}
          />
        </div>
      ))}
      {chosen && (
        <TrackDetail
          track={chosen.track}
          status={chosen.status}
          cruiseAltitudeFt={cruiseAltitudeFt}
          issues={issues}
        />
      )}
    </div>
  );
}
