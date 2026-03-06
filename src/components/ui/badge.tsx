import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils/helpers';

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
        /* Categorical color badges */
        'cat-emerald': 'border-cat-emerald/30 bg-cat-emerald/20 text-cat-emerald',
        'cat-sky': 'border-cat-sky/30 bg-cat-sky/20 text-cat-sky',
        'cat-amber': 'border-cat-amber/30 bg-cat-amber/20 text-cat-amber',
        'cat-red': 'border-cat-red/30 bg-cat-red/20 text-cat-red',
        'cat-fuchsia': 'border-cat-fuchsia/30 bg-cat-fuchsia/20 text-cat-fuchsia',
        'cat-blue': 'border-cat-blue/30 bg-cat-blue/20 text-cat-blue',
        'cat-orange': 'border-cat-orange/30 bg-cat-orange/20 text-cat-orange',
        'cat-pink': 'border-cat-pink/30 bg-cat-pink/20 text-cat-pink',
        'cat-teal': 'border-cat-teal/30 bg-cat-teal/20 text-cat-teal',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
