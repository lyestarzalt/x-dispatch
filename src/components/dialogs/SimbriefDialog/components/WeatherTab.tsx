import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaneLanding, PlaneTakeoff, Route, Wind } from 'lucide-react';
import { parseMetar } from 'metar-taf-parser';
import { Separator } from '@/components/ui/separator';
import { primaryAlternate } from '@/lib/simbrief/ofp';
import type { SimBriefOFP } from '@/types/simbrief';
import { MetarCard } from './MetarCard';

// Weather Tab
export function WeatherTab({ data }: { data: SimBriefOFP }) {
  const { t } = useTranslation();
  // Parse METARs
  const originMetar = useMemo(() => {
    if (!data.origin.metar) return null;
    try {
      return parseMetar(data.origin.metar);
    } catch {
      return null;
    }
  }, [data.origin.metar]);

  const destMetar = useMemo(() => {
    if (!data.destination.metar) return null;
    try {
      return parseMetar(data.destination.metar);
    } catch {
      return null;
    }
  }, [data.destination.metar]);

  const alternate = primaryAlternate(data);
  const alternateMetarRaw = alternate?.metar;
  const altMetar = useMemo(() => {
    if (!alternateMetarRaw) return null;
    try {
      return parseMetar(alternateMetarRaw);
    } catch {
      return null;
    }
  }, [alternateMetarRaw]);

  return (
    <div className="space-y-4">
      {/* Origin Weather */}
      <MetarCard
        icao={data.origin.icao_code}
        icon={PlaneTakeoff}
        rawMetar={data.origin.metar}
        parsedMetar={originMetar}
        taf={data.origin.taf}
      />

      {/* Destination Weather */}
      <MetarCard
        icao={data.destination.icao_code}
        icon={PlaneLanding}
        rawMetar={data.destination.metar}
        parsedMetar={destMetar}
        taf={data.destination.taf}
      />

      {/* Alternate Weather */}
      {alternate && (
        <MetarCard
          icao={alternate.icao_code}
          icon={Route}
          label={t('simbriefDialog.weather.alternate')}
          rawMetar={alternate.metar}
          parsedMetar={altMetar}
        />
      )}

      {/* Winds Aloft */}
      <div className="bg-card rounded-lg border p-4">
        <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
          <Wind className="h-3.5 w-3.5" />
          {t('simbriefDialog.weather.windsAloft')}
        </h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <Wind
                className="h-6 w-6"
                style={{ transform: `rotate(${parseInt(data.general.avg_wind_dir, 10)}deg)` }}
              />
            </div>
            <div>
              <p className="font-mono text-2xl font-bold">
                {t('simbriefDialog.weather.directionDeg', { deg: data.general.avg_wind_dir })}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('simbriefDialog.weather.direction')}
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div>
            <p className="font-mono text-2xl font-bold">
              {t('simbriefDialog.weather.speedKt', { speed: data.general.avg_wind_spd })}
            </p>
            <p className="text-muted-foreground text-xs">{t('simbriefDialog.weather.speed')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
