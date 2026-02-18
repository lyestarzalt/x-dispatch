import { cn } from '@/lib/utils/helpers';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-2',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-primary border-t-transparent',
        sizeClasses[size],
        className
      )}
    />
  );
}

interface FullScreenSpinnerProps {
  className?: string;
}

export function FullScreenSpinner({ className }: FullScreenSpinnerProps) {
  return (
    <div
      className={cn('flex h-screen w-screen items-center justify-center bg-background', className)}
    >
      <Spinner size="md" />
    </div>
  );
}
