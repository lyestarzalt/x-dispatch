import * as React from 'react';
import { cn } from '@/lib/utils/helpers';

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />
  )
);
Skeleton.displayName = 'Skeleton';

export { Skeleton };
