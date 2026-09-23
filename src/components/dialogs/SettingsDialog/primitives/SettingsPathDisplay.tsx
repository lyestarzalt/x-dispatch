import { cn } from '@/lib/utils/helpers';

interface SettingsPathDisplayProps {
  path: string;
  className?: string;
}

/**
 * Single-line truncated mono path display.
 *
 * Used for filesystem paths anywhere they appear in settings.
 * Hover reveals the full path via `title`.
 */
export function SettingsPathDisplay({ path, className }: SettingsPathDisplayProps) {
  return (
    <p
      title={path}
      className={cn(
        'bg-secondary/50 text-muted-foreground truncate rounded px-3 py-2 font-mono text-sm',
        className
      )}
    >
      {path}
    </p>
  );
}
