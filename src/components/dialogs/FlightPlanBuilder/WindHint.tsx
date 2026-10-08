import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wind } from 'lucide-react';
import { formatWind } from '@/lib/utils/metar';
import { useAirportRunways } from '@/queries/useAirportRunways';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import type { RunwayEnd } from '@/types/fms';

/** Wind within this many degrees of a runway heading makes it the suggested one. */
const WIND_SUGGEST_MIN_KT = 4;

/** The runway end best aligned with the reported wind, when the wind is worth acting on. */
function windRunway(
  ends: RunwayEnd[] | undefined,
  wind: { degrees?: number; speed: number } | undefined
): RunwayEnd | null {
  if (!ends || !wind || wind.degrees === undefined || wind.speed < WIND_SUGGEST_MIN_KT) return null;
  let best: RunwayEnd | null = null;
  let bestDelta = Infinity;
  for (const end of ends) {
    let delta = Math.abs(end.headingDeg - wind.degrees);
    if (delta > 180) delta = 360 - delta;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = end;
    }
  }
  return best;
}

export function WindHint({
  icao,
  selected,
  onUse,
}: {
  icao: string;
  selected: string | undefined;
  onUse: (end: RunwayEnd) => void;
}) {
  const { t } = useTranslation();
  const { data: metar } = useVatsimMetarQuery(icao);
  const { data: ends } = useAirportRunways(icao);
  const wind = metar?.parsed.wind;
  const best = useMemo(() => windRunway(ends, wind), [ends, wind]);
  if (!best || best.name === selected) return null;
  return (
    <button
      type="button"
      onClick={() => onUse(best)}
      className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1.5 text-xs"
    >
      <Wind className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {t('planBuilder.windSuggest', {
          wind: formatWind(wind, { bare: true }),
          runway: best.name,
        })}
      </span>
      <span className="text-primary shrink-0 font-medium">{t('planBuilder.useRunway')}</span>
    </button>
  );
}
