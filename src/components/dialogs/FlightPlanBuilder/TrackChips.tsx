import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cruiseFitsTrack } from '@/lib/flightplan/builder/trackChoice';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';

const AUTO = 'auto';

/** Flight levels are feet by convention, so the band is not unit-aware. */
function levelBand(levels: number[], label: (from: number, to: number) => string): string | null {
  if (levels.length === 0) return null;
  return label(Math.min(...levels), Math.max(...levels));
}

export function TrackChips({
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
      size="xs"
      variant="outline"
      className="flex-wrap justify-start"
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (!v) return;
        onPick(v === AUTO ? null : v);
      }}
    >
      {withAuto && <ToggleGroupItem value={AUTO}>{t('planBuilder.tracks.auto')}</ToggleGroupItem>}
      {tracks.map((track) => {
        const band = levelBand(track.levels, levels);
        const fits = cruiseFitsTrack(track, cruiseAltitudeFt);
        return (
          <ToggleGroupItem
            key={track.name}
            value={track.name}
            className={cn('gap-1', !fits && 'border-warning/40')}
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
