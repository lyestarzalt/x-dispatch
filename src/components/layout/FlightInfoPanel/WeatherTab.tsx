import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaneLanding, PlaneTakeoff, Route } from 'lucide-react';
import { parseMetar } from 'metar-taf-parser';
import { primaryAlternate } from '@/lib/simbrief/ofp';
import type { SimBriefOFP } from '@/types/simbrief';
import { WeatherCard } from './WeatherCard';

// Weather Tab
export function WeatherTab({ data }: { data: SimBriefOFP }) {
  const { t } = useTranslation();
  const alternate = primaryAlternate(data);
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

  return (
    <div className="space-y-3">
      {/* Origin */}
      <WeatherCard
        icao={data.origin.icao_code}
        icon={PlaneTakeoff}
        metar={originMetar}
        rawMetar={data.origin.metar}
      />

      {/* Destination */}
      <WeatherCard
        icao={data.destination.icao_code}
        icon={PlaneLanding}
        metar={destMetar}
        rawMetar={data.destination.metar}
      />

      {/* Alternate */}
      {alternate && (
        <div className="bg-warning/10 rounded-lg p-2">
          <div className="text-warning flex items-center gap-2 text-sm">
            <Route className="h-3 w-3" />
            <span className="font-mono font-medium">{alternate.icao_code}</span>
            <span className="text-warning/70">{t('flightInfoPanel.alternate')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
