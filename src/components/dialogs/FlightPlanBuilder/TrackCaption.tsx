import type * as React from 'react';
import { cn } from '@/lib/utils/helpers';

export function Caption({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('xp-label min-w-0 truncate', className)}>{children}</span>;
}
