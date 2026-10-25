import { AirportLocalClock } from '@/components/AirportLocalClock';
import { IcaoCode } from '@/components/ui/icao-code';
import { cn } from '@/lib/utils/helpers';

/** One end of the route in the header: large ICAO over the airport name and its local time. */
export function RouteEnd({
  endpoint,
  fallback,
  align = 'left',
}: {
  endpoint: { icao: string; name?: string; latitude: number; longitude: number } | null;
  fallback: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
      <IcaoCode className="block text-2xl font-bold">{endpoint?.icao ?? '----'}</IcaoCode>
      <div className="text-muted-foreground truncate text-xs">{endpoint?.name ?? fallback}</div>
      {endpoint && (
        <AirportLocalClock
          icao={endpoint.icao}
          latitude={endpoint.latitude}
          longitude={endpoint.longitude}
          align={align}
          className="mt-0.5"
        />
      )}
    </div>
  );
}
