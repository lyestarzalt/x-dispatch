import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
        <Button variant="outline" className="h-10 w-full justify-between px-3 font-normal">
          {value ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-sm font-semibold">{value.icao}</span>
              <span className="text-muted-foreground truncate text-xs">{value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
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
                  <span className="mr-2 font-mono text-sm font-semibold">{airport.icao}</span>
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
