import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, Loader2, Waves } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  type NatDirection,
  cruiseFitsTrack,
  messagesForDirection,
  trackFixString,
  validityLabel,
} from '@/lib/flightplan/builder/trackChoice';
import type {
  NatFeed,
  NatMessageInfo,
  OceanicTrackInfo,
  RouteIssue,
} from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';

const AUTO = 'auto';

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

/** Flight levels are feet by convention, so the band is not unit-aware. */
function levelBand(levels: number[], label: (from: number, to: number) => string): string | null {
  if (levels.length === 0) return null;
  return label(Math.min(...levels), Math.max(...levels));
}

function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('xp-label min-w-0 truncate', className)}>{children}</span>;
}

function TrackChips({
  tracks,
  selected,
  cruiseAltitudeFt,
  disabled,
  withAuto,
  onPick,
}: {
  tracks: OceanicTrackInfo[];
  selected: string | null;
  cruiseAltitudeFt: number | null;
  disabled?: boolean;
  withAuto: boolean;
  onPick: (track: string | null) => void;
}) {
  const { t } = useTranslation();
  const levels = (from: number, to: number) => t('planBuilder.tracks.levels', { from, to });
  const value =
    selected && tracks.some((tr) => tr.name === selected)
      ? selected
      : withAuto && !selected
        ? AUTO
        : '';
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      className="flex-wrap justify-start"
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (!v) return;
        onPick(v === AUTO ? null : v);
      }}
    >
      {withAuto && (
        <ToggleGroupItem value={AUTO} className="h-7 px-2.5 text-xs">
          {t('planBuilder.tracks.auto')}
        </ToggleGroupItem>
      )}
      {tracks.map((track) => {
        const band = levelBand(track.levels, levels);
        const fits = cruiseFitsTrack(track, cruiseAltitudeFt);
        return (
          <ToggleGroupItem
            key={track.name}
            value={track.name}
            className={cn('h-7 gap-1 px-2 text-xs', !fits && 'border-warning/40')}
            aria-label={t('planBuilder.tracks.track', { id: track.id })}
            title={band ?? undefined}
          >
            <span className="font-mono font-semibold">{track.id}</span>
            {band && (
              <span className={cn('text-xs', fits ? 'text-muted-foreground' : 'text-warning')}>
                {band}
              </span>
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function MessageCaption({ message, upcoming }: { message: NatMessageInfo; upcoming: boolean }) {
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
              size="sm"
              className="h-6 w-6 shrink-0 p-0"
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

function TrackDetail({
  track,
  upcoming,
  cruiseAltitudeFt,
  issues,
}: {
  track: OceanicTrackInfo;
  upcoming: boolean;
  cruiseAltitudeFt: number | null;
  issues: RouteIssue[];
}) {
  const { t } = useTranslation();
  const fits = cruiseFitsTrack(track, cruiseAltitudeFt);
  const warnings: string[] = [];
  if (!fits && cruiseAltitudeFt !== null) {
    warnings.push(
      t('planBuilder.tracks.levelWarning', {
        cruise: Math.round(cruiseAltitudeFt / 100),
        id: track.id,
        levels: track.levels.join(', '),
      })
    );
  }
  if (issues.includes('trackPartial')) warnings.push(t('planBuilder.issues.trackPartial'));
  return (
    <div className="border-border/60 space-y-1.5 rounded-lg border p-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="xp-value font-semibold">
          {t('planBuilder.tracks.track', { id: track.id })}
        </span>
        {upcoming && (
          <Badge variant="info" className="px-1.5 py-0">
            {t('planBuilder.tracks.upcoming')}
          </Badge>
        )}
        {track.pbcs && (
          <Badge variant="outline" className="px-1.5 py-0">
            {t('planBuilder.tracks.pbcs')}
          </Badge>
        )}
        {track.levels.length > 0 && (
          <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
            {t('planBuilder.tracks.levelList', { levels: track.levels.join(' ') })}
          </span>
        )}
      </div>
      <p className="font-mono text-xs leading-5 break-words">{trackFixString(track)}</p>
      {(track.nars.length > 0 || track.feederFixes.length > 0) && (
        <p className="text-muted-foreground min-w-0 truncate font-mono text-xs">
          {[
            track.nars.length > 0 && t('planBuilder.tracks.nar', { list: track.nars.join(' ') }),
            track.feederFixes.length > 0 &&
              t('planBuilder.tracks.eurRts', { list: track.feederFixes.join(' ') }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-warning flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
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
        <Waves className="text-muted-foreground h-4 w-4 shrink-0" />
        <Caption>{t('planBuilder.tracks.title')}</Caption>
        <span className="text-muted-foreground shrink-0 text-xs">
          {t(`planBuilder.tracks.${direction}`)}
        </span>
        {disabled && <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />}
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
      <p className="text-muted-foreground text-xs">{t('planBuilder.tracks.hint')}</p>
    </div>
  );
}
