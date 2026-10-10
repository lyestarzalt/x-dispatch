import { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils/helpers';

interface SettingsSliderRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Percent, shown as typed; the row never converts units. */
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
  resetLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Bordered row: label/description on the left, slider with its percent readout
 * and a reset link on the right. The slider is linked to the title via
 * `aria-labelledby`.
 */
export function SettingsSliderRow({
  title,
  description,
  value,
  defaultValue,
  min,
  max,
  step,
  onCommit,
  resetLabel,
  disabled,
  className,
}: SettingsSliderRowProps) {
  const titleId = useId();
  const [preview, setPreview] = useState<number | null>(null);
  const display = preview ?? value;

  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg border p-4', className)}>
      <div className="min-w-0 space-y-1">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div className="flex w-1/2 shrink-0 items-center gap-3">
        <Slider
          aria-labelledby={titleId}
          value={[display]}
          onValueChange={(v) => {
            if (v[0] !== undefined) setPreview(v[0]);
          }}
          onValueCommit={(v) => {
            setPreview(null);
            if (v[0] !== undefined) onCommit(v[0]);
          }}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="flex-1"
        />
        <span className="min-w-[4ch] text-center font-mono text-sm">{display}%</span>
        <Button
          variant="ghost"
          size="xs"
          className={cn('text-muted-foreground', value === defaultValue && 'invisible')}
          disabled={disabled}
          onClick={() => onCommit(defaultValue)}
          aria-label={resetLabel}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
