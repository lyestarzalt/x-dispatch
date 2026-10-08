import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/stores/appStore';
import type { Runway } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import { GateList } from './start/GateList';
import { HelipadList } from './start/HelipadList';
import { RunwayList } from './start/RunwayList';

type ViewType = 'gates' | 'runways' | 'helipads';

interface StartTabProps {
  onSelectGate?: (gate: NamedPosition) => void;
  onSelectRunwayEnd?: (runwayEnd: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  onSelectHelipad?: (helipad: NamedPosition) => void;
}

export default function StartTab({
  onSelectGate,
  onSelectRunwayEnd,
  onSelectRunway,
  onSelectHelipad,
}: StartTabProps) {
  const { t } = useTranslation();

  const airport = useAppStore((s) => s.selectedAirportData);
  const selectedStartPosition = useAppStore((s) => s.startPosition);

  const runways = useMemo(() => airport?.runways ?? [], [airport?.runways]);
  const gates = useMemo(() => airport?.startupLocations ?? [], [airport?.startupLocations]);
  const helipads = useMemo(() => airport?.helipads ?? [], [airport?.helipads]);

  // Default to first non-empty category
  const defaultView = gates.length > 0 ? 'gates' : runways.length > 0 ? 'runways' : 'helipads';
  const [viewType, setViewType] = useState<ViewType>(defaultView);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-switch sub-tab and scroll to selected item when position changes
  const prevPositionRef = useRef<typeof selectedStartPosition>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedStartPosition || selectedStartPosition === prevPositionRef.current) return;
    prevPositionRef.current = selectedStartPosition;

    // Switch sub-tab to match map-driven position selection.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (selectedStartPosition.type === 'ramp') setViewType('gates');
    else if (selectedStartPosition.isHelipad) setViewType('helipads');
    else if (selectedStartPosition.type === 'runway') setViewType('runways');
    /* eslint-enable react-hooks/set-state-in-effect */

    // Scroll to the selected item after sub-tab switch renders
    setTimeout(() => {
      const el = containerRef.current?.querySelector('[data-selected="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [selectedStartPosition]);

  // Clear search when switching tabs
  const handleTabChange = (value: string) => {
    setViewType(value as ViewType);
    setSearchQuery('');
  };

  // Only show tabs that have data
  const tabs = [
    { id: 'gates' as const, labelKey: 'airportInfo.tabs.gates', count: gates.length },
    { id: 'runways' as const, labelKey: 'airportInfo.tabs.runways', count: runways.length },
    { id: 'helipads' as const, labelKey: 'airportInfo.tabs.helipads', count: helipads.length },
  ].filter((tab) => tab.count > 0);

  // Current list count for showing search
  const currentCount =
    viewType === 'gates' ? gates.length : viewType === 'runways' ? runways.length : helipads.length;
  const showSearch = currentCount > 8;

  if (tabs.length === 0) {
    return (
      <p className="text-muted-foreground/60 py-12 text-center text-sm">
        {t('airportInfo.noStartPositions')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle - only show if multiple categories */}
      {tabs.length > 1 && (
        <Tabs value={viewType} onValueChange={handleTabChange}>
          <TabsList variant="line" className="border-border/30 gap-3">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-0 text-sm">
                {t(tab.labelKey)}
                <span className="text-muted-foreground/50 ml-1.5">{tab.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Search input - only show for lists > 8 items */}
      {showSearch && (
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={t('airportInfo.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border/50 bg-muted/30 h-8 pr-8 pl-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <div ref={containerRef}>
        {viewType === 'gates' && (
          <GateList
            gates={gates}
            searchQuery={searchQuery}
            onSelect={onSelectGate}
            selectedIndex={
              selectedStartPosition?.type === 'ramp' ? selectedStartPosition.index : undefined
            }
          />
        )}
        {viewType === 'runways' && (
          <RunwayList
            runways={runways}
            searchQuery={searchQuery}
            onSelectEnd={onSelectRunwayEnd}
            onSelectRunway={onSelectRunway}
            selectedIndex={
              selectedStartPosition?.type === 'runway' ? selectedStartPosition.index : undefined
            }
          />
        )}
        {viewType === 'helipads' && (
          <HelipadList
            helipads={helipads}
            searchQuery={searchQuery}
            runwayCount={runways.length}
            onSelect={onSelectHelipad}
            selectedIndex={
              selectedStartPosition?.isHelipad ? selectedStartPosition.index : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
