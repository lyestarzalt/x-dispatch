import { type ReactElement, cloneElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsRemoteClient } from '@/hooks/useIsRemoteClient';

interface DesktopOnlyProps {
  /** One interactive element that accepts `disabled`. */
  children: ReactElement<{ disabled?: boolean }>;
  className?: string;
}

/**
 * Wraps a control that needs the PC (native dialogs, files on disk). On a
 * tablet the control is disabled and a tooltip says where to find it; it
 * opens on hover and on tap, since touch has no hover.
 */
export function DesktopOnly({ children, className }: DesktopOnlyProps) {
  const { t } = useTranslation();
  const remote = useIsRemoteClient();
  const [open, setOpen] = useState(false);
  if (!remote) return children;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span className={className ?? 'inline-flex'} onClick={() => setOpen((o) => !o)}>
          {cloneElement(children, { disabled: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-1.5">
        <Monitor className="h-3.5 w-3.5" />
        {t('tablet.desktopOnly')}
      </TooltipContent>
    </Tooltip>
  );
}
