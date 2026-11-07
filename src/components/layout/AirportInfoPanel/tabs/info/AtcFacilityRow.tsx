import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnits } from '@/hooks/useUnits';
import type { Feet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { ATCController, ATCRole } from '@/types/navigation';
import { TuneStrip } from './TuneStrip';

/** Chart-style role codes; `tracon` is the US approach facility. */
const ROLE_KEYS: Record<ATCRole, string> = {
  del: 'airportInfo.atcRole.del',
  gnd: 'airportInfo.atcRole.gnd',
  twr: 'airportInfo.atcRole.twr',
  app: 'airportInfo.atcRole.app',
  tracon: 'airportInfo.atcRole.app',
  ctr: 'airportInfo.atcRole.ctr',
};

/** The full 0–60,000 ft column carries no information; hide it. */
const FULL_COLUMN_MAX_FT = 60000;

const formatMhz = (mhz: number) => mhz.toFixed(3);

/**
 * One area-control facility over the airport (approach / centre from the nav
 * data's controller database), as a row of the FREQUENCIES list. Expands to
 * all of its sector frequencies, the selected one feeding the tune strip.
 */
export function AtcFacilityRow({
  controller,
  expanded,
  onToggle,
}: {
  controller: ATCController;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const units = useUnits();
  const [selected, setSelected] = useState(0);

  const freqs = controller.frequencies;
  const primaryFreq = freqs[0];

  // The facility's vertical extent across all its shelves.
  const band =
    controller.airspaces.length > 0
      ? {
          minAlt: Math.min(...controller.airspaces.map((a) => a.minAlt)),
          maxAlt: Math.max(...controller.airspaces.map((a) => a.maxAlt)),
        }
      : null;
  const showBand = band && (band.minAlt > 0 || band.maxAlt < FULL_COLUMN_MAX_FT);
  const bandText = showBand
    ? `${band.minAlt > 0 ? units.altitude(band.minAlt as Feet) : t('airportInfo.atcSurface')} – ${
        band.maxAlt < FULL_COLUMN_MAX_FT
          ? units.altitude(band.maxAlt as Feet)
          : t('airportInfo.atcUnlimited')
      }`
    : null;

  return (
    <li>
      <Button
        variant="ghost"
        onClick={onToggle}
        className="bg-muted/20 hover:bg-muted/40 h-auto w-full flex-col items-stretch gap-0 rounded-md px-2.5 py-1.5 text-left"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="bg-muted-foreground/30 h-1.5 w-1.5 shrink-0 rounded-full" />
            <Badge
              variant="outline"
              className="text-2xs shrink-0 px-1.5 py-0 font-mono font-semibold uppercase"
            >
              {t(ROLE_KEYS[controller.role])}
            </Badge>
            <span className="text-foreground truncate text-xs">{controller.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {primaryFreq !== undefined && (
              <span className="text-foreground font-mono text-sm tabular-nums">
                {formatMhz(primaryFreq)}
              </span>
            )}
            <ChevronDown
              className={cn(
                'text-muted-foreground/60 h-3 w-3 shrink-0 transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </div>
        </div>
        {(bandText || freqs.length > 1) && (
          <div className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-2 pl-[1.65rem] text-xs">
            {bandText && <span className="truncate">{bandText}</span>}
            {freqs.length > 1 && (
              <span className="shrink-0">
                {t('airportInfo.atcSectorFreqs', { count: freqs.length })}
              </span>
            )}
          </div>
        )}
      </Button>
      {expanded && (
        <div className="bg-muted/15 mt-1 space-y-2 rounded-md px-2.5 py-2">
          {freqs.length > 1 && (
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
              {freqs.map((f, i) => (
                <Button
                  key={`${f}-${i}`}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(i)}
                  className={cn(
                    'h-6 px-1.5 font-mono text-xs tabular-nums',
                    i === selected && 'border-primary text-primary'
                  )}
                >
                  {formatMhz(f)}
                </Button>
              ))}
            </div>
          )}
          {freqs[selected] !== undefined && (
            <TuneStrip freq={formatMhz(freqs[selected]!)} onTuned={onToggle} />
          )}
        </div>
      )}
    </li>
  );
}
