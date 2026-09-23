import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { IcaoCode } from '@/components/ui/icao-code';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import type { Airport } from '@/lib/xplaneServices/dataService';

const MAX_RESULTS = 8;

/** Same ranking as the toolbar search: exact ICAO, then ICAO prefix, then anything containing. */
export function rankAirports(airports: Airport[], rawQuery: string): Airport[] {
  const query = rawQuery.trim().toUpperCase();
  if (query.length < 2) return [];
  const matches = airports.filter(
    (a) => a.icao.toUpperCase().includes(query) || a.name.toUpperCase().includes(query)
  );
  const score = (a: Airport) => {
    const icao = a.icao.toUpperCase();
    if (icao === query) return 0;
    if (icao.startsWith(query)) return 1;
    if (icao.includes(query)) return 2;
    return 3;
  };
  return matches.sort((a, b) => score(a) - score(b)).slice(0, MAX_RESULTS);
}

export function toEndpoint(airport: Airport): PlanEndpoint {
  return { icao: airport.icao, name: airport.name, latitude: airport.lat, longitude: airport.lon };
}

interface AirportPickerProps {
  airports: Airport[];
  value: PlanEndpoint | null;
  placeholder: string;
  onChange: (endpoint: PlanEndpoint | null) => void;
}

export function AirportPicker({ airports, value, placeholder, onChange }: AirportPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => rankAirports(airports, query), [airports, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-input bg-secondary ring-offset-background focus:ring-ring hover:bg-secondary/80 flex h-9 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors focus:ring-1 focus:outline-none"
        >
          {value ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <IcaoCode className="text-sm">{value.icao}</IcaoCode>
              <span className="text-muted-foreground truncate text-xs">{value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('planBuilder.searchPlaceholder')}
          />
          <CommandList>
            <CommandEmpty>{t('planBuilder.noAirports')}</CommandEmpty>
            <CommandGroup>
              {results.map((airport) => (
                <CommandItem
                  key={airport.icao}
                  value={airport.icao}
                  onSelect={() => {
                    onChange(toEndpoint(airport));
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <IcaoCode className="mr-2 w-12 shrink-0 text-sm">{airport.icao}</IcaoCode>
                  <span className="text-muted-foreground truncate text-xs">{airport.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
