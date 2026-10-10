import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatLevel } from '@/lib/flightplan/builder/formatLevel';

/** The cruise figure doubles as its own editor: click, type feet, Enter or blur to apply. */
export function CruiseStat({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (feet: number | null) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => {
    const feet = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(feet) && feet >= 0) {
      onChange(Math.round(feet / 100) * 100);
    }
    setEditing(false);
  };
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground truncate text-xs">{label}</span>
      {editing ? (
        <Input
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-6 w-20 px-1.5 font-mono text-sm tabular-nums"
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                setDraft(value === null ? '' : String(value));
                setEditing(true);
              }}
              aria-label={t('planBuilder.editCruise')}
              className="xp-value hover:text-primary flex items-center gap-1 text-left font-semibold tabular-nums"
            >
              {formatLevel(value)}
              <Pencil className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('planBuilder.editCruise')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
