import { useTranslation } from 'react-i18next';
import { Runway } from '@/lib/aptParser/types';
import { DecodedMETAR, calculateWindComponents } from '@/utils/decodeMetar';

interface WeatherDetailsProps {
  metar?: DecodedMETAR | null;
  metarRaw?: string;
  taf?: string | null;
  selectedRunway?: Runway | null;
}

export default function WeatherDetails({
  metar,
  metarRaw,
  taf,
  selectedRunway,
}: WeatherDetailsProps) {
  const { t } = useTranslation();

  if (!metar && !taf) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">{t('sidebar.noWeatherData')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {metar && (
        <>
          {/* Conditions grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Visibility */}
            {metar.visibility && (
              <WeatherStat label={t('sidebar.visibility')} value={formatVisibility(metar)} />
            )}

            {/* Altimeter */}
            {metar.altimeter !== null && (
              <WeatherStat
                label={t('sidebar.altimeter')}
                value={
                  metar.altimeterUnit === 'inHg'
                    ? `${metar.altimeter.toFixed(2)}"`
                    : `${metar.altimeter} hPa`
                }
              />
            )}

            {/* Temperature */}
            {metar.temperature !== null && (
              <WeatherStat label={t('sidebar.temp')} value={`${metar.temperature}°C`} />
            )}

            {/* Dewpoint */}
            {metar.dewpoint !== null && (
              <WeatherStat label={t('sidebar.dewpoint')} value={`${metar.dewpoint}°C`} />
            )}
          </div>

          {/* Clouds */}
          {metar.clouds && metar.clouds.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="mb-1 text-[10px] text-muted-foreground">{t('sidebar.clouds')}</p>
              <div className="flex flex-wrap gap-1.5">
                {metar.clouds.map((c, i) => (
                  <span
                    key={i}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                  >
                    {c.cover} {c.altitude ? `${c.altitude * 100}'` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weather phenomena */}
          {metar.weather && metar.weather.length > 0 && (
            <div className="rounded border border-yellow-500/20 bg-yellow-500/10 p-2">
              <p className="font-mono text-xs text-yellow-400">{metar.weather.join(', ')}</p>
            </div>
          )}

          {/* Runway wind components */}
          {selectedRunway &&
            metar.wind &&
            metar.wind.direction !== 'VRB' &&
            metar.wind.speed > 0 && <RunwayWindComponent metar={metar} runway={selectedRunway} />}
        </>
      )}

      {/* Raw METAR */}
      {metarRaw && (
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="mb-1 text-[10px] text-muted-foreground">METAR</p>
          <p className="break-all font-mono text-[11px] leading-relaxed text-foreground/80">
            {metarRaw}
          </p>
        </div>
      )}

      {/* TAF */}
      {taf && (
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="mb-1 text-[10px] text-muted-foreground">TAF</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
            {taf}
          </pre>
        </div>
      )}
    </div>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function formatVisibility(metar: DecodedMETAR): string {
  if (!metar.visibility) return '--';
  const modifier =
    metar.visibility.modifier === 'P' ? '>' : metar.visibility.modifier === 'M' ? '<' : '';
  const val = metar.visibility.value ?? '--';
  const unit = metar.visibility.unit === 'SM' ? ' SM' : 'm';
  return `${modifier}${val}${unit}`;
}

function RunwayWindComponent({ metar, runway }: { metar: DecodedMETAR; runway: Runway }) {
  if (!metar.wind || metar.wind.direction === 'VRB' || metar.wind.speed === 0) {
    return null;
  }

  const e1 = runway.ends[0];
  const e2 = runway.ends[1];
  const heading1 = parseInt(e1.name.replace(/[LRC]/g, ''), 10) * 10;
  const heading2 = parseInt(e2.name.replace(/[LRC]/g, ''), 10) * 10;

  const comp1 = calculateWindComponents(metar.wind.direction as number, metar.wind.speed, heading1);
  const comp2 = calculateWindComponents(metar.wind.direction as number, metar.wind.speed, heading2);

  const favorable = comp1.headwind > comp2.headwind ? e1 : e2;
  const favorableComp = comp1.headwind > comp2.headwind ? comp1 : comp2;

  return (
    <div className="rounded border border-green-500/20 bg-green-500/10 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] text-muted-foreground">
          RUNWAY {e1.name}/{e2.name}
        </span>
        <span className="font-mono text-[9px] font-bold text-green-400">Use {favorable.name}</span>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">
        {favorableComp.headwind > 0 ? 'HW' : 'TW'} {Math.abs(favorableComp.headwind)}kt | XW{' '}
        {favorableComp.crosswind}kt {favorableComp.crosswindDirection}
      </div>
    </div>
  );
}
