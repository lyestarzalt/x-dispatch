import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-xp-accent-hover',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-accent',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border-border text-foreground',
        success: 'border-success/30 bg-success/20 text-success',
        warning: 'border-warning/30 bg-warning/20 text-warning',
        info: 'border-info/30 bg-info/20 text-info',
        danger: 'border-destructive/30 bg-destructive/20 text-destructive',
        violet: 'border-violet/30 bg-violet/20 text-violet',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
