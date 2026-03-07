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
            'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-secondary px-3 ring-offset-background transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            className
          )}
        >
          {startIcon && (
            <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{startIcon}</span>
          )}
          <input
            type={type}
            ref={ref}
            className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            {...props}
          />
          {endIcon && (
            <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{endIcon}</span>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm ring-offset-background transition-shadow file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
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
