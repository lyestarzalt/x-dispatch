import { LoaderIcon } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

function FullScreenSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('bg-background flex h-full w-full items-center justify-center', className)}>
      <Spinner className="text-primary size-6" />
    </div>
  );
}

export { Spinner, FullScreenSpinner };
