import { IcaoCode } from '@/components/ui/icao-code';
import { cn } from '@/lib/utils/helpers';

/** One end of the route in the header: large ICAO over the airport name. */
export function RouteEnd({
  endpoint,
  fallback,
  align = 'left',
}: {
  endpoint: { icao: string; name?: string } | null;
  fallback: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
      <IcaoCode className="block text-2xl font-bold">{endpoint?.icao ?? '----'}</IcaoCode>
      <div className="text-muted-foreground truncate text-xs">{endpoint?.name ?? fallback}</div>
    </div>
  );
}
