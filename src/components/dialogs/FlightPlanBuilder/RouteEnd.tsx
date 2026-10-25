import { AirportLocalClock } from '@/components/AirportLocalClock';
import { IcaoCode } from '@/components/ui/icao-code';
import { cn } from '@/lib/utils/helpers';

/**
 * One end of the route in the header: large ICAO over the airport name and its local time.
 * `fallback` ("Departure", "Arrival") names an empty slot; an airport the plan knows only by
 * code gets its name from the airport list, and shows nothing rather than the placeholder.
 */
export function RouteEnd({
  endpoint,
  fallback,
  nameOf,
  align = 'left',
}: {
  endpoint: { icao: string; name?: string; latitude: number; longitude: number } | null;
  fallback: string;
  nameOf?: (icao: string) => string | undefined;
  align?: 'left' | 'right';
}) {
  const name = endpoint ? (endpoint.name ?? nameOf?.(endpoint.icao) ?? '') : fallback;
  return (
    <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
      <IcaoCode className="block text-2xl font-bold">{endpoint?.icao ?? '----'}</IcaoCode>
      <div className="text-muted-foreground min-h-4 truncate text-xs">{name}</div>
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
