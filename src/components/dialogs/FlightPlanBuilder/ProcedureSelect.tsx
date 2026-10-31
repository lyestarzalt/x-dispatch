import { useMemo, useState } from 'react';
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
  /** Spell out the procedure name for display; the choice keeps the raw name. */
  labelFor?: (procedure: ResolvedProcedure) => string;
}

/** One entry per procedure name and transition, filtered to the chosen runway. */
export function ProcedureSelect({
  procedures,
  runway,
  value,
  placeholder,
  onChange,
  className,
  labelFor,
}: ProcedureSelectProps) {
  const { t } = useTranslation();
  const options = useMemo(() => {
    const seen = new Map<string, ProcedureChoice & { label: string }>();
    for (const p of proceduresForRunway(procedures, runway)) {
      const choice = {
        name: p.name,
        transition: p.transition ?? null,
        label: labelFor?.(p) ?? p.name,
      };
      seen.set(choiceKey(choice), choice);
    }
    return [...seen.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name) || (a.transition ?? '').localeCompare(b.transition ?? '')
    );
  }, [procedures, runway, labelFor]);

  // Radix mounts every item even while the list is closed, so that the trigger
  // can show the chosen item's text. A hundred procedures re-rendered on every
  // planner render adds up, so the items only mount while the list is open or
  // the trigger has focus (typing a letter on the closed select searches them),
  // and the trigger text is written here instead.
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selectedKey = value ? choiceKey(value) : NONE;
  const selected = value ? options.find((o) => choiceKey(o) === selectedKey) : undefined;
  const label = (o: { label: string; transition: string | null }) => (
    <>
      {o.label}
      {o.transition && <span className="text-muted-foreground ml-2">{o.transition}</span>}
    </>
  );

  return (
    <Select
      value={selectedKey}
      onValueChange={(v) => onChange(options.find((o) => choiceKey(o) === v))}
      disabled={options.length === 0}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger
        className={className ?? 'h-9 font-mono text-xs'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <SelectValue placeholder={placeholder}>
          {value ? selected && label(selected) : t('planBuilder.noProcedure')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(open || focused) && (
          <>
            <SelectItem value={NONE}>{t('planBuilder.noProcedure')}</SelectItem>
            {options.map((o) => (
              <SelectItem key={choiceKey(o)} value={choiceKey(o)} className="font-mono text-xs">
                {label(o)}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
