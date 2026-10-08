import { useTranslation } from 'react-i18next';
import { PlaneTakeoff } from 'lucide-react';
import type { IMetar } from 'metar-taf-parser';
import { formatAltimeter, formatVisibility, formatWind } from '@/lib/utils/metar';

export function WeatherCard({
  icao,
  icon: Icon,
  metar,
  rawMetar,
}: {
  icao: string;
  icon: typeof PlaneTakeoff;
  metar: IMetar | null;
  rawMetar: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="text-muted-foreground h-3 w-3" />
        <span className="font-mono text-sm font-medium">{icao}</span>
      </div>

      {metar && (
        <div className="mb-2 grid grid-cols-4 gap-1 text-center">
          <div>
            <p className="text-2xs font-mono font-medium">
              {formatWind(metar.wind, { bare: true })}
            </p>
            <p className="text-muted-foreground text-2xs">{t('flightInfoPanel.wind')}</p>
          </div>
          <div>
            <p className="text-2xs font-mono font-medium">
              {formatVisibility(metar.visibility, metar.cavok)}
            </p>
            <p className="text-muted-foreground text-2xs">{t('flightInfoPanel.vis')}</p>
          </div>
          <div>
            <p className="text-2xs font-mono font-medium">
              {t('flightInfoPanel.tempDeg', { value: metar.temperature ?? '—' })}
            </p>
            <p className="text-muted-foreground text-2xs">{t('flightInfoPanel.temp')}</p>
          </div>
          <div>
            <p className="text-2xs font-mono font-medium">
              {formatAltimeter(metar.altimeter, { bare: true })}
            </p>
            <p className="text-muted-foreground text-2xs">{t('flightInfoPanel.qnh')}</p>
          </div>
        </div>
      )}

      <p className="text-muted-foreground text-2xs font-mono leading-relaxed">
        {rawMetar || t('flightInfoPanel.noMetar')}
      </p>
    </div>
  );
}
