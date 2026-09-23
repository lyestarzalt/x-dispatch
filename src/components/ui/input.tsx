import * as React from 'react';
import { cn } from '@/lib/utils/helpers';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, ...props }, ref) => {
    if (startIcon || endIcon) {
      return (
        <div
          className={cn(
            'border-input bg-secondary ring-offset-background focus-within:border-primary focus-within:ring-ring flex h-10 w-full items-center gap-2 rounded-lg border px-3 transition-shadow focus-within:ring-2 focus-within:ring-offset-2',
            className
          )}
        >
          {startIcon && (
            <span className="text-muted-foreground flex shrink-0 [&_svg]:size-4">{startIcon}</span>
          )}
          <input
            type={type}
            ref={ref}
            className="placeholder:text-muted-foreground h-full w-full min-w-0 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            {...props}
          />
          {endIcon && (
            <span className="text-muted-foreground flex shrink-0 [&_svg]:size-4">{endIcon}</span>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'border-input bg-secondary ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm transition-shadow file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
