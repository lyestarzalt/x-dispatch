import { useTranslation } from 'react-i18next';
import type { Runway } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import { RunwayRow } from './RunwayRow';

export function RunwaysSection({
  runways,
  ilsByEnd,
  gsByEnd,
  activeEndNames,
}: {
  runways: Runway[];
  ilsByEnd: Map<string, Navaid>;
  gsByEnd: Map<string, Navaid>;
  activeEndNames: Set<string>;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="xp-section-heading mb-0 border-b-0">{t('airportInfo.runwaysHeading')}</h4>
        <span className="text-muted-foreground text-xs">
          {t('airportInfo.runwayCountTotal', { count: runways.length })}
        </span>
      </div>
      <ul className="space-y-1">
        {runways.map((rwy, i) => (
          <RunwayRow
            key={i}
            runway={rwy}
            ilsByEnd={ilsByEnd}
            gsByEnd={gsByEnd}
            activeEndNames={activeEndNames}
          />
        ))}
      </ul>
    </section>
  );
}
