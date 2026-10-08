import { useTranslation } from 'react-i18next';
import { Waves } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type NatDirection, messagesForDirection } from '@/lib/flightplan/builder/trackChoice';
import type { NatFeed, RouteIssue } from '@/lib/flightplan/builder/types';
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
 * its level band, and the chosen track's fix string, levels, NARs and feeder fixes.
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
  const { current, upcoming } = messagesForDirection(feed, direction);
  const chosenCurrent = selected ? current?.tracks.find((tr) => tr.name === selected) : undefined;
  const chosenUpcoming = selected ? upcoming?.tracks.find((tr) => tr.name === selected) : undefined;
  const chosen = chosenCurrent
    ? { track: chosenCurrent, upcoming: false }
    : chosenUpcoming
      ? { track: chosenUpcoming, upcoming: true }
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
      {!current && !upcoming && (
        <p className="text-muted-foreground text-xs">
          {feed?.error && feed.messages.length === 0
            ? t('planBuilder.tracks.unavailable', { reason: feed.error })
            : t('planBuilder.tracks.none')}
        </p>
      )}
      {current && (
        <div className="space-y-1.5">
          <MessageCaption message={current} upcoming={false} />
          <TrackChips
            tracks={current.tracks}
            selected={selected}
            cruiseAltitudeFt={cruiseAltitudeFt}
            disabled={disabled}
            withAuto
            onPick={onPick}
          />
        </div>
      )}
      {upcoming && (
        <div className="space-y-1.5">
          <MessageCaption message={upcoming} upcoming />
          <TrackChips
            tracks={upcoming.tracks}
            selected={selected}
            cruiseAltitudeFt={cruiseAltitudeFt}
            disabled={disabled}
            withAuto={!current}
            onPick={onPick}
          />
        </div>
      )}
      {chosen && (
        <TrackDetail
          track={chosen.track}
          upcoming={chosen.upcoming}
          cruiseAltitudeFt={cruiseAltitudeFt}
          issues={issues}
        />
      )}
    </div>
  );
}
