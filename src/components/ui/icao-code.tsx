import * as React from 'react';
import { cn } from '@/lib/utils/helpers';

/** An airport or fix identifier the way the app prints them everywhere: mono, bold, accent. */
const IcaoCode = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('text-info font-mono font-semibold tracking-tight', className)}
      {...props}
    />
  )
);
IcaoCode.displayName = 'IcaoCode';

export { IcaoCode };
