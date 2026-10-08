import { useTranslation } from 'react-i18next';
import { Waves } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { NatDirection } from '@/lib/flightplan/builder/trackChoice';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';

const AUTO = 'auto';

interface TrackPickerProps {
  /** Tracks published for the direction flown. */
  tracks: OceanicTrackInfo[];
  direction: NatDirection;
  /** Designator filed in the route ("NATA"), or null when the router chose freely. */
  selected: string | null;
  disabled?: boolean;
  /** A designator to route through, or null to let the router choose again. */
  onPick: (track: string | null) => void;
}

/** Flight levels are always feet by convention, so the band is not unit-aware. */
function levelBand(levels: number[], label: (from: number, to: number) => string): string | null {
  if (levels.length === 0) return null;
  return label(Math.min(...levels), Math.max(...levels));
}

/**
 * The North Atlantic tracks offered for the crossing: one chip per track, "Auto" for the
 * router's own choice. Picking one re-routes through it; the map mirrors the selection.
 */
export function TrackPicker({ tracks, direction, selected, disabled, onPick }: TrackPickerProps) {
  const { t } = useTranslation();
  const levels = (from: number, to: number) => t('planBuilder.tracks.levels', { from, to });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Waves className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground min-w-0 truncate text-[10px] tracking-wider uppercase">
          {t('planBuilder.tracks.title')}
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {t(`planBuilder.tracks.${direction}`)}
        </span>
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">{t('planBuilder.tracks.none')}</p>
      ) : (
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          className="flex-wrap justify-start"
          value={selected ?? AUTO}
          disabled={disabled}
          onValueChange={(v) => {
            if (!v) return;
            onPick(v === AUTO ? null : v);
          }}
        >
          <ToggleGroupItem value={AUTO} className="h-7 px-2.5 text-xs">
            {t('planBuilder.tracks.auto')}
          </ToggleGroupItem>
          {tracks.map((track) => {
            const band = levelBand(track.levels, levels);
            return (
              <ToggleGroupItem
                key={track.name}
                value={track.name}
                className="h-7 gap-1 px-2 text-xs"
                aria-label={t('planBuilder.tracks.track', { id: track.id })}
                title={band ?? undefined}
              >
                <span className="font-mono font-semibold">{track.id}</span>
                {band && <span className="text-muted-foreground text-[10px]">{band}</span>}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}
      <p className="text-muted-foreground text-[11px]">{t('planBuilder.tracks.hint')}</p>
    </div>
  );
}
