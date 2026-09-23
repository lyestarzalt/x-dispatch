import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { choiceKey, proceduresForRunway } from '@/lib/flightplan/builder/procedures';
import type { ProcedureChoice } from '@/lib/flightplan/builder/types';
import type { ResolvedProcedure } from '@/types/navigation';

const NONE = '__none__';

interface ProcedureSelectProps {
  procedures: ResolvedProcedure[];
  runway: string | undefined;
  value: ProcedureChoice | undefined;
  placeholder: string;
  onChange: (choice: ProcedureChoice | undefined) => void;
  className?: string;
}

/** One entry per procedure name and transition, filtered to the chosen runway. */
export function ProcedureSelect({
  procedures,
  runway,
  value,
  placeholder,
  onChange,
  className,
}: ProcedureSelectProps) {
  const { t } = useTranslation();
  const options = useMemo(() => {
    const seen = new Map<string, ProcedureChoice>();
    for (const p of proceduresForRunway(procedures, runway)) {
      const choice = { name: p.name, transition: p.transition ?? null };
      seen.set(choiceKey(choice), choice);
    }
    return [...seen.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name) || (a.transition ?? '').localeCompare(b.transition ?? '')
    );
  }, [procedures, runway]);

  return (
    <Select
      value={value ? choiceKey(value) : NONE}
      onValueChange={(v) => onChange(options.find((o) => choiceKey(o) === v))}
      disabled={options.length === 0}
    >
      <SelectTrigger className={className ?? 'h-9 font-mono text-xs'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('planBuilder.noProcedure')}</SelectItem>
        {options.map((o) => (
          <SelectItem key={choiceKey(o)} value={choiceKey(o)} className="font-mono text-xs">
            {o.name}
            {o.transition && <span className="text-muted-foreground ml-2">{o.transition}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
