import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { metersToFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { Helipad } from '@/types/apt';
import { NamedPosition } from '@/types/geo';

interface HelipadListProps {
  helipads: Helipad[];
  searchQuery: string;
  /** Land and water runways ahead of the helipads in X-Plane's start list. */
  runwayCount: number;
  onSelect?: (helipad: NamedPosition) => void;
  selectedIndex?: number;
}

export function HelipadList({
  helipads,
  searchQuery,
  runwayCount,
  onSelect,
  selectedIndex,
}: HelipadListProps) {
  const { t } = useTranslation();
  // Filter helipads by search
  const filteredHelipads = useMemo(() => {
    if (!searchQuery.trim()) return helipads.map((h, i) => ({ helipad: h, originalIndex: i }));
    const query = searchQuery.toLowerCase();
    return helipads
      .map((h, i) => ({ helipad: h, originalIndex: i }))
      .filter((item) => item.helipad.name.toLowerCase().includes(query));
  }, [helipads, searchQuery]);

  if (helipads.length === 0) {
    return (
      <p className="text-muted-foreground/60 py-8 text-center text-sm">
        {t('airportInfo.noHelipads')}
      </p>
    );
  }

  if (filteredHelipads.length === 0) {
    return (
      <p className="text-muted-foreground/60 py-8 text-center text-sm">
        {t('airportInfo.noHelipadsMatching', { query: searchQuery })}
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {filteredHelipads.map(({ helipad, originalIndex }) => {
        const isSelected = selectedIndex === originalIndex;
        const sizeFt = `${Math.round(metersToFeet(helipad.length))}'×${Math.round(metersToFeet(helipad.width))}'`;
        const xplaneIndex = `${helipad.startRow ?? runwayCount + originalIndex}_0`;

        return (
          <Button
            key={originalIndex}
            data-selected={isSelected || undefined}
            variant="ghost"
            onClick={() =>
              onSelect?.({
                latitude: helipad.latitude,
                longitude: helipad.longitude,
                name: helipad.name,
                heading: helipad.heading,
                index: originalIndex,
                xplaneIndex,
              })
            }
            className={cn(
              'h-auto w-full justify-between rounded px-2.5 py-2 text-left',
              isSelected
                ? 'bg-cat-emerald/10 text-cat-emerald'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
          >
            <span className="font-mono text-sm">{helipad.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/50 text-2xs">{sizeFt}</span>
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </div>
          </Button>
        );
      })}
    </div>
  );
}
