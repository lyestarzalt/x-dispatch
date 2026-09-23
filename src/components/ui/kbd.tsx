import * as React from 'react';
import { cn } from '@/lib/utils/helpers';

const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'border-border bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm border px-1 font-mono text-xs font-medium select-none',
        "[&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
);
Kbd.displayName = 'Kbd';

const KbdGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('inline-flex items-center gap-1', className)} {...props} />
  )
);
KbdGroup.displayName = 'KbdGroup';

export { Kbd, KbdGroup };
