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
    <div
      className={cn(
        'border-border/60 flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
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
