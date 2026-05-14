import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/helpers';

interface SettingsToggleRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Bordered row: label/description on the left, switch on the right.
 *
 * Canonical shape: `rounded-lg border p-4`, label uses
 * `text-sm font-medium`, description uses `text-sm text-muted-foreground`.
 * The switch is linked to the title via `aria-labelledby` so screen
 * readers announce the toggle's name.
 */
export function SettingsToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SettingsToggleRowProps) {
  const titleId = useId();
  return (
    <div className={cn('flex items-center justify-between rounded-lg border p-4', className)}>
      <div className="min-w-0 space-y-1 pr-3">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <Switch
        aria-labelledby={titleId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
