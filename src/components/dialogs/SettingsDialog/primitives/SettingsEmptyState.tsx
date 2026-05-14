import { cn } from '@/lib/utils/helpers';

interface SettingsEmptyStateProps {
  message: React.ReactNode;
  className?: string;
}

/**
 * "Nothing to show" state. Bordered container, centered muted text.
 *
 * Use anywhere a list/section is empty by user state (not by error).
 * For error states, render a bordered destructive surface inline —
 * we don't generalise that yet because it only happens in Logs.
 */
export function SettingsEmptyState({ message, className }: SettingsEmptyStateProps) {
  return (
    <div className={cn('rounded-lg border py-6 text-center', className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
