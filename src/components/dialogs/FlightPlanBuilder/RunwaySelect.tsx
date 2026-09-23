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
import type { RunwayEnd } from '@/types/fms';
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
  onChange: (runway: string | undefined, end?: RunwayEnd) => void;
  className?: string;
}

/** apt.dat is the source of truth; procedures fill in when the airport file is not available. */
export function RunwaySelect({ icao, value, onChange, className }: RunwaySelectProps) {
  const { t } = useTranslation();
  const { data: aptRunways, isLoading } = useAirportRunways(icao);
  const { data: procedures } = useAirportProcedures(icao);
  const runways = useMemo(
    () =>
      sortRunways([...(aptRunways ?? []).map((e) => e.name), ...runwaysFromProcedures(procedures)]),
    [aptRunways, procedures]
  );

  if (!icao) return null;

  if (runways.length === 0 && !isLoading) {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.toUpperCase().trim() || undefined)}
        placeholder={t('planBuilder.runwayPlaceholder')}
        className={className ?? 'h-9 font-mono uppercase'}
        maxLength={3}
      />
    );
  }

  return (
    <Select
      value={value ?? ANY}
      onValueChange={(v) => {
        if (v === ANY) return onChange(undefined);
        onChange(
          v,
          aptRunways?.find((e) => e.name === v)
        );
      }}
      disabled={isLoading}
    >
      <SelectTrigger className={className ?? 'h-9 font-mono'}>
        <SelectValue>{value ?? t('planBuilder.anyShort')}</SelectValue>
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
