import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import type { VatsimAirportAtcRow } from '@/types/vatsimSectors';
import { TuneStrip } from './TuneStrip';

export function FrequencyRow({
  row,
  expanded,
  onToggle,
}: {
  row: MergedFreqRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const live = row.live;
  const displayFreq = live?.frequency ?? row.staticFreq ?? '';
  const showName =
    !!row.staticName && row.staticName.trim().toUpperCase() !== row.label.toUpperCase();
  const hasAtisBody = !!live?.atisBody;

  return (
    <li>
      <Button
        variant="ghost"
        onClick={onToggle}
        className={cn(
          'h-auto w-full flex-col items-stretch gap-0 rounded-md px-2.5 py-1.5 text-left',
          live
            ? 'bg-cat-emerald/5 ring-cat-emerald/25 hover:bg-cat-emerald/10 ring-1'
            : 'bg-muted/20 hover:bg-muted/40'
        )}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {live ? (
              <span className="relative flex h-1.5 w-1.5 shrink-0" aria-label={t('common.online')}>
                <span className="bg-cat-emerald/60 absolute inline-flex h-full w-full animate-ping rounded-full" />
                <span className="bg-cat-emerald relative inline-flex h-1.5 w-1.5 rounded-full" />
              </span>
            ) : (
              <span className="bg-muted-foreground/30 h-1.5 w-1.5 shrink-0 rounded-full" />
            )}
            <Badge
              variant={live ? row.badgeVariant : 'outline'}
              className="text-2xs shrink-0 px-1.5 py-0 font-mono font-semibold uppercase"
            >
              {live?.badgeLabel ?? row.label}
            </Badge>
            {showName && (
              <span className="text-muted-foreground/70 truncate text-xs">{row.staticName}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                live ? 'text-info' : 'text-foreground'
              )}
            >
              {displayFreq}
            </span>
            <ChevronDown
              className={cn(
                'text-muted-foreground/60 h-3 w-3 shrink-0 transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </div>
        </div>
        {live && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 pl-[1.65rem] text-xs">
            <span className="text-foreground/80 font-mono">{live.callsign}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate">{live.controllerName}</span>
          </div>
        )}
      </Button>
      {expanded && (
        <div className="bg-muted/15 mt-1 space-y-2 rounded-md px-2.5 py-2">
          <TuneStrip freq={displayFreq} onTuned={onToggle} />
          {hasAtisBody && live?.atisBody && (
            <pre className="text-muted-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {live.atisBody}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Renderer-shape row for the merged Frequencies list. A row is either:
 *  - a static apt.dat frequency, optionally enriched with a matched live
 *    VATSIM controller (`live` populated)
 *  - a VATSIM-only "extra" (CTR, FSS, additional same-role controllers)
 *    where there's no static counterpart (`staticName` / `staticFreq` undefined,
 *    `live` always populated).
 */
export interface MergedFreqRow {
  id: string;
  label: string;
  badgeVariant: VatsimAirportAtcRow['badgeVariant'];
  staticName?: string;
  staticFreq?: string;
  live?: {
    badgeLabel: string;
    callsign: string;
    controllerName: string;
    frequency: string;
    atisBody?: string;
  };
}
