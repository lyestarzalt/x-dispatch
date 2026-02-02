import { useTranslation } from 'react-i18next';
import { Cloud, Radio, Thermometer, Wind } from 'lucide-react';
import { Frequency } from '@/lib/aptParser/types';
import { formatFrequency } from '@/lib/format';
import { DecodedMETAR } from '@/utils/decodeMetar';

interface QuickWeatherProps {
  metar?: DecodedMETAR | null;
  atisFrequency?: Frequency | null;
}

export default function QuickWeather({ metar, atisFrequency }: QuickWeatherProps) {
  const { t } = useTranslation();

  if (!metar) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-center text-xs text-muted-foreground">{t('sidebar.noWeatherData')}</p>
      </div>
    );
  }

  const windStr = formatWind(metar);
  const tempStr = metar.temperature !== null ? `${metar.temperature}°C` : '--';
  const ceilingStr = formatCeiling(metar);

  const handleCopyFrequency = () => {
    if (atisFrequency) {
      navigator.clipboard.writeText(formatFrequency(atisFrequency.frequency));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* Temperature */}
        <div className="flex items-center gap-1.5">
          <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-foreground">{tempStr}</span>
        </div>

        {/* Wind */}
        <div className="flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-foreground">{windStr}</span>
        </div>

        {/* Ceiling */}
        <div className="flex items-center gap-1.5">
          <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-foreground">{ceilingStr}</span>
        </div>
      </div>

      {/* ATIS Frequency */}
      {atisFrequency && (
        <button
          onClick={handleCopyFrequency}
          className="mt-2 flex w-full items-center gap-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs transition-colors hover:bg-muted"
          title={t('sidebar.copyFrequency')}
        >
          <Radio className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-muted-foreground">ATIS</span>
          <span className="ml-auto font-mono text-foreground">
            {formatFrequency(atisFrequency.frequency)}
          </span>
        </button>
      )}
    </div>
  );
}

function formatWind(metar: DecodedMETAR): string {
  if (!metar.wind) return '--';
  const dir = metar.wind.direction === 'VRB' ? 'VRB' : `${metar.wind.direction}°`;
  const spd = metar.wind.speed;
  const gust = metar.wind.gust;
  return gust ? `${dir}/${spd}G${gust}kt` : `${dir}/${spd}kt`;
}

function formatCeiling(metar: DecodedMETAR): string {
  if (!metar.clouds || metar.clouds.length === 0) return 'CLR';
  const ceiling = metar.clouds.find((c) => c.cover === 'BKN' || c.cover === 'OVC');
  if (!ceiling?.altitude) {
    // Show first cloud layer if no ceiling
    const firstCloud = metar.clouds[0];
    if (firstCloud?.altitude) {
      return `${firstCloud.cover} ${firstCloud.altitude * 100}'`;
    }
    return 'CLR';
  }
  return `${ceiling.altitude * 100}'`;
}
