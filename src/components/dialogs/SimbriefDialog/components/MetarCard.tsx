import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Droplets, Eye, Gauge, PlaneTakeoff, Thermometer, Wind } from 'lucide-react';
import type { IMetar } from 'metar-taf-parser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatAltimeter,
  formatCeiling,
  formatVisibility,
  formatWeatherConditions,
  formatWind,
} from '@/lib/utils/metar';
import { MetarItem } from './MetarItem';

// METAR Card Component with decoded display
export function MetarCard({
  icao,
  icon: Icon,
  label,
  rawMetar,
  parsedMetar,
  taf,
}: {
  icao: string;
  icon: typeof PlaneTakeoff;
  label?: string;
  rawMetar: string;
  parsedMetar: IMetar | null;
  taf?: string;
}) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(!parsedMetar);
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
          <Icon className="h-3.5 w-3.5" />
          {label ? t('simbriefDialog.weather.icaoWithLabel', { icao, label }) : icao}
        </h4>
        <Badge variant="outline" className="text-2xs">
          {t('simbriefDialog.weather.metar')}
        </Badge>
      </div>

      {/* Decoded METAR Display */}
      {parsedMetar && (
        <div className="mb-3 grid grid-cols-5 gap-2">
          <MetarItem
            icon={Wind}
            label={t('simbriefDialog.weather.wind')}
            value={formatWind(parsedMetar.wind)}
          />
          <MetarItem
            icon={Eye}
            label={t('simbriefDialog.weather.visibility')}
            value={formatVisibility(parsedMetar.visibility, parsedMetar.cavok)}
          />
          <MetarItem
            icon={Cloud}
            label={t('simbriefDialog.weather.ceiling')}
            value={formatCeiling(parsedMetar.clouds, parsedMetar.verticalVisibility)}
          />
          <MetarItem
            icon={Thermometer}
            label={t('simbriefDialog.weather.temp')}
            value={parsedMetar.temperature !== undefined ? `${parsedMetar.temperature}°C` : '—'}
          />
          <MetarItem
            icon={Gauge}
            label={t('simbriefDialog.weather.qnh')}
            value={formatAltimeter(parsedMetar.altimeter)}
          />
        </div>
      )}

      {/* Weather conditions */}
      {parsedMetar?.weatherConditions && parsedMetar.weatherConditions.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <Droplets className="text-muted-foreground h-3.5 w-3.5" />
          <span className="font-mono text-sm font-medium">
            {formatWeatherConditions(parsedMetar.weatherConditions)}
          </span>
        </div>
      )}

      {/* Raw METAR: the decoded tiles say the same thing, so the text waits behind a toggle */}
      {parsedMetar && (
        <Button
          variant="link"
          size="sm"
          onClick={() => setShowRaw((v) => !v)}
          className="text-muted-foreground h-auto p-0 text-xs"
        >
          {showRaw ? t('simbriefDialog.weather.hideRaw') : t('simbriefDialog.weather.showRaw')}
        </Button>
      )}
      {showRaw && (
        <div className="bg-muted/50 mt-2 rounded p-3">
          <p className="font-mono text-sm leading-relaxed">
            {rawMetar || t('simbriefDialog.noMetarAvailable')}
          </p>
        </div>
      )}

      {/* TAF */}
      {taf && (
        <div className="mt-3">
          <Badge variant="outline" className="text-2xs mb-2">
            {t('simbriefDialog.weather.taf')}
          </Badge>
          <div className="bg-muted/50 rounded p-3">
            <p className="font-mono text-sm leading-relaxed">{taf}</p>
          </div>
        </div>
      )}
    </div>
  );
}
