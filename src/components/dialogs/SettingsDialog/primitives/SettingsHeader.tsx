import type { LucideIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface SettingsHeaderProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Page header that opens every settings tab.
 *
 * Always renders the icon + title row, the description (if given),
 * and a trailing `<Separator />`. Sections SHOULD NOT add their own
 * Separator after this — it's already included.
 */
export function SettingsHeader({
  icon: Icon,
  iconClassName,
  title,
  description,
}: SettingsHeaderProps) {
  return (
    <>
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className={iconClassName ?? 'h-5 w-5'} />
          {title}
        </h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <Separator />
    </>
  );
}
