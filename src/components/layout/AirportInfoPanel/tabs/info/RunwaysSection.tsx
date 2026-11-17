import { useTranslation } from 'react-i18next';
import type { Runway } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import type { EndUse } from './ActiveRunwayLine';
import { CompactToggle } from './CompactToggle';
import { RunwayRow } from './RunwayRow';

export function RunwaysSection({
  runways,
  ilsByEnd,
  gsByEnd,
  endUse,
  totalCount,
  compact,
  onToggleCompact,
}: {
  runways: Runway[];
  /** Every runway at the airport, also while the list shows only the active ones. */
  totalCount: number;
  /** Null when the list cannot be compacted: no runway is active, or all of them are. */
  compact: boolean | null;
  onToggleCompact: () => void;
  ilsByEnd: Map<string, Navaid>;
  gsByEnd: Map<string, Navaid>;
  endUse: Map<string, EndUse>;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <h4 className="xp-section-heading mb-0 truncate border-b-0">
            {compact ? t('airportInfo.activeRunwaysHeading') : t('airportInfo.runwaysHeading')}
          </h4>
          {compact !== null && <CompactToggle compact={compact} onToggle={onToggleCompact} />}
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {t('airportInfo.runwayCountTotal', { count: totalCount })}
        </span>
      </div>
      <ul className="space-y-2">
        {runways.map((rwy, i) => (
          <RunwayRow
            key={i}
            runway={rwy}
            ilsByEnd={ilsByEnd}
            gsByEnd={gsByEnd}
            endUse={endUse}
            activeEndsOnly={compact === true}
          />
        ))}
      </ul>
    </section>
  );
}
