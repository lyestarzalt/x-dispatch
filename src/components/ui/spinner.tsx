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
    <div className={cn('flex h-full w-full items-center justify-center bg-background', className)}>
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

export { Spinner, FullScreenSpinner };
