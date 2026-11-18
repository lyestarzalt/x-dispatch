import * as React from 'react';
import { cn } from '@/lib/utils/helpers';

const ICAO_CODE_CLASS = 'text-info font-mono font-semibold tracking-tight';

/**
 * An airport or fix identifier the way the app prints them everywhere: mono, bold, accent.
 * With `onClick` it is a button (for example to open the airport), styled the same.
 */
const IcaoCode = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, onClick, ...props }, ref) =>
    onClick ? (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        className={cn(
          ICAO_CODE_CLASS,
          'focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none',
          className
        )}
        {...props}
      />
    ) : (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn(ICAO_CODE_CLASS, className)}
        {...props}
      />
    )
);
IcaoCode.displayName = 'IcaoCode';

export { IcaoCode };
