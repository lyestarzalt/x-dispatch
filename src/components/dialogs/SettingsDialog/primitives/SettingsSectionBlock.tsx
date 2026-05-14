import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

interface SettingsSectionBlockProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wrapper for a content block inside a settings tab.
 *
 * Renders the `space-y-3` + `xp-section-heading` shape. Sections
 * separate adjacent blocks with `<Separator />` themselves — the
 * wrapper doesn't include trailing whitespace.
 */
export function SettingsSectionBlock({
  title,
  description,
  icon: Icon,
  className,
  children,
}: SettingsSectionBlockProps) {
  const hasHeading = !!title || !!description;
  return (
    <div className={cn('space-y-3', className)}>
      {hasHeading ? (
        <div>
          {title ? (
            <h3 className="xp-section-heading flex items-center gap-2">
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {title}
            </h3>
          ) : null}
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
