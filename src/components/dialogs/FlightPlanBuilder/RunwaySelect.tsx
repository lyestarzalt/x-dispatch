import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAirportProcedures } from '@/queries';
import { useAirportRunways } from '@/queries/useAirportRunways';
import type { AirportProcedures } from '@/types/navigation';

const ANY = '__any__';

/** Runways named by any SID, STAR or approach at the airport. */
export function runwaysFromProcedures(procedures: AirportProcedures | null | undefined): string[] {
  if (!procedures) return [];
  const names = new Set<string>();
  for (const list of [procedures.sids, procedures.stars, procedures.approaches]) {
    for (const p of list) {
      if (!p.runway || p.runway === 'ALL') continue;
      const bare = p.runway.toUpperCase().replace(/^RW/, '');
      if (/^\d{2}[LCR]?$/.test(bare)) names.add(bare);
    }
  }
  return [...names];
}

function sortRunways(names: Iterable<string>): string[] {
  return [...new Set(names)].sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b)
  );
}

interface RunwaySelectProps {
  icao: string | null;
  value: string | undefined;
  onChange: (runway: string | undefined) => void;
}

/** apt.dat is the source of truth; procedures fill in when the airport file is not available. */
export function RunwaySelect({ icao, value, onChange }: RunwaySelectProps) {
  const { t } = useTranslation();
  const { data: aptRunways, isLoading } = useAirportRunways(icao);
  const { data: procedures } = useAirportProcedures(icao);
  const runways = useMemo(
    () => sortRunways([...(aptRunways ?? []), ...runwaysFromProcedures(procedures)]),
    [aptRunways, procedures]
  );

  if (!icao) return null;

  if (runways.length === 0 && !isLoading) {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.toUpperCase().trim() || undefined)}
        placeholder={t('planBuilder.runwayPlaceholder')}
        className="h-9 w-24 font-mono uppercase"
        maxLength={3}
      />
    );
  }

  return (
    <Select
      value={value ?? ANY}
      onValueChange={(v) => onChange(v === ANY ? undefined : v)}
      disabled={isLoading}
    >
      <SelectTrigger className="h-9 w-32 font-mono">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t('planBuilder.anyRunway')}</SelectItem>
        {runways.map((rwy) => (
          <SelectItem key={rwy} value={rwy} className="font-mono">
            {rwy}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
