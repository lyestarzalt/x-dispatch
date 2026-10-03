import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';

interface SettingsChoiceRowProps<TValue extends string> {
  title: React.ReactNode;
  /** Secondary line under the title; for units, the live example in the chosen unit. */
  description?: React.ReactNode;
  value: TValue;
  options: ReadonlyArray<{ value: TValue; label: React.ReactNode }>;
  onChange: (value: TValue) => void;
  /**
   * `inline`: short labels (unit tokens) sit beside the title, right-aligned.
   * `stacked`: long labels get their own row under the title, left-aligned with
   * it, each button as wide as its label.
   */
  layout?: 'inline' | 'stacked';
  className?: string;
}

/**
 * Bordered row for a setting with two to four fixed options. Same row shape
 * as `SettingsToggleRow`; the buttons follow the option pickers in Appearance
 * and Graphics (filled for the chosen value, outline for the rest).
 */
export function SettingsChoiceRow<TValue extends string>({
  title,
  description,
  value,
  options,
  onChange,
  layout = 'inline',
  className,
}: SettingsChoiceRowProps<TValue>) {
  const titleId = useId();
  const stacked = layout === 'stacked';
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        stacked ? 'space-y-3' : 'flex items-center justify-between gap-4',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        className={cn('flex gap-2', stacked ? 'flex-wrap' : 'shrink-0')}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Button
              key={opt.value}
              role="radio"
              aria-checked={selected}
              variant={selected ? 'default' : 'outline'}
              size="sm"
              className={cn('min-w-14 px-4 whitespace-nowrap', selected && 'pointer-events-none')}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
