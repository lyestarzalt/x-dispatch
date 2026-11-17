import { useTranslation } from 'react-i18next';
import { Intensity } from 'metar-taf-parser';
import type { IWeatherCondition } from 'metar-taf-parser';
import { formatAltimeter, formatCeiling, formatVisibility, formatWind } from '@/lib/utils/metar';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { type ActiveRunway, ActiveRunwayLine } from './ActiveRunwayLine';
import { KvRow } from './KvRow';

export function ConditionsCard({
  metar,
  activeRunway,
  atisLetter,
}: {
  metar: ParsedMetar | null;
  activeRunway: ActiveRunway | null;
  atisLetter: string | null;
}) {
  const { t } = useTranslation();
  return (
    <section>
      {!metar && !activeRunway && (
        <div className="bg-muted/10 text-muted-foreground rounded-lg p-3 text-center text-sm">
          {t('airportInfo.noWeather')}
        </div>
      )}
      {metar && (
        <div className="bg-card/40 rounded-lg px-3 py-2.5 text-sm">
          <KvRow label={t('airportInfo.conditions.wind')} value={formatWind(metar.wind, VERBOSE)} />
          <KvRow
            label={t('airportInfo.conditions.visibility')}
            value={formatVisibility(metar.visibility, metar.cavok, VERBOSE)}
          />
          <KvRow
            label={t('airportInfo.conditions.ceiling')}
            value={formatCeiling(metar.clouds, metar.verticalVisibility, VERBOSE)}
          />
          <KvRow
            label={t('airportInfo.conditions.qnh')}
            value={formatAltimeter(metar.altimeter, VERBOSE)}
          />
          <KvRow
            label={t('airportInfo.conditions.tempDew')}
            value={t('airportInfo.conditions.tempDewValue', {
              temp: metar.temperature ?? '—',
              dew: metar.dewPoint ?? '—',
            })}
          />
          {metar.weatherConditions.length > 0 && (
            <KvRow
              label={t('airportInfo.conditions.phenomena')}
              value={formatWeatherConditions(metar.weatherConditions)}
            />
          )}
        </div>
      )}
      <ActiveRunwayLine activeRunway={activeRunway} atisLetter={atisLetter} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers — METAR formatting
// ---------------------------------------------------------------------------

// Re-typed inline because metar-taf-parser doesn't export the parsed shape;
// we just borrow the field set the hook already returns.
const VERBOSE = { verbose: true } as const;

type ParsedMetar = NonNullable<ReturnType<typeof useVatsimMetarQuery>['data']>['parsed'];

function formatWeatherConditions(conditions: IWeatherCondition[]): string {
  return conditions
    .map((c) => {
      let str = '';
      if (c.intensity === Intensity.LIGHT) str += '-';
      else if (c.intensity === Intensity.HEAVY) str += '+';
      else if (c.intensity === Intensity.IN_VICINITY) str += 'VC';
      if (c.descriptive) str += c.descriptive;
      str += c.phenomenons.join('');
      return str;
    })
    .join(', ');
}
