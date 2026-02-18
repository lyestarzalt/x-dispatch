import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Info,
  MessageSquare,
  PlaneTakeoff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useAppStore } from '@/stores/appStore';
import type { Runway } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import CommsTab from './tabs/CommsTab';
import InfoTab from './tabs/InfoTab';
import RouteTab from './tabs/RouteTab';
import StartTab from './tabs/StartTab';

type TabId = 'info' | 'start' | 'route' | 'comms';

interface Tab {
  id: TabId;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'info', icon: <Info className="h-4 w-4" /> },
  { id: 'start', icon: <PlaneTakeoff className="h-4 w-4" /> },
  { id: 'route', icon: <Compass className="h-4 w-4" /> },
  { id: 'comms', icon: <MessageSquare className="h-4 w-4" /> },
];

const TAB_LABELS: Record<TabId, string> = {
  info: 'Info',
  start: 'Start',
  route: 'Route',
  comms: 'Comms',
};

interface SidebarProps {
  onSelectRunway?: (runway: Runway) => void;
  onSelectGateAsStart?: (gate: NamedPosition) => void;
  onSelectRunwayEndAsStart?: (runwayEnd: NamedPosition) => void;
  onSelectHelipadAsStart?: (helipad: NamedPosition) => void;
}

export default function Sidebar({
  onSelectRunway,
  onSelectGateAsStart,
  onSelectRunwayEndAsStart,
  onSelectHelipadAsStart,
}: SidebarProps) {
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const selectedStartPosition = useAppStore((s) => s.startPosition);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const flightCategory = vatsimMetarData?.decoded?.flightCategory ?? null;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('info');

  if (!airport) return null;

  return (
    <div
      className={cn(
        'absolute bottom-4 right-4 top-20 z-20 transition-all duration-300 ease-out',
        isCollapsed ? 'w-12' : 'w-80'
      )}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/95 shadow-xl backdrop-blur-sm">
        {/* Collapsed state */}
        <div
          className={cn(
            'absolute inset-0 z-20 flex flex-col items-center bg-card/95 py-5 transition-opacity duration-200',
            isCollapsed ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="mb-4 h-8 w-8"
            onClick={() => setIsCollapsed(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span
            className="font-mono text-sm font-bold tracking-wider text-foreground"
            style={{ writingMode: 'vertical-rl' }}
          >
            {airport.id}
          </span>
        </div>

        {/* Collapse button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute right-3 top-3 z-10 h-7 w-7 text-muted-foreground/40 hover:text-foreground',
            isCollapsed && 'pointer-events-none opacity-0'
          )}
          onClick={() => setIsCollapsed(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Header - ICAO + Location + Flight Category */}
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {airport.id}
            </h1>
            {flightCategory && (
              <Badge
                variant="outline"
                className={cn(
                  'border px-2.5 py-1 font-mono text-xs font-bold',
                  flightCategory === 'VFR' &&
                    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                  flightCategory === 'MVFR' && 'border-sky-500/30 bg-sky-500/10 text-sky-400',
                  flightCategory === 'IFR' && 'border-red-500/30 bg-red-500/10 text-red-400',
                  flightCategory === 'LIFR' &&
                    'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400'
                )}
              >
                {flightCategory}
              </Badge>
            )}
          </div>
          {/* Location from metadata */}
          {(airport.metadata.city || airport.metadata.country) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[airport.metadata.city, airport.metadata.state || airport.metadata.country]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>

        {/* Selected position indicator */}
        {selectedStartPosition && (
          <div className="mx-5 mb-4 flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2">
            <span className="text-xs text-emerald-400/70">Starting position</span>
            <span className="font-mono text-sm font-medium text-emerald-400">
              {selectedStartPosition.name}
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-border/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 border-b-2 py-3 transition-colors',
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              <span className="text-xs font-medium">{TAB_LABELS[tab.id]}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <ScrollArea className="flex-1">
          <div className="p-5">
            {activeTab === 'info' && <InfoTab />}
            {activeTab === 'start' && (
              <StartTab
                onSelectGate={onSelectGateAsStart}
                onSelectRunwayEnd={onSelectRunwayEndAsStart}
                onSelectRunway={onSelectRunway}
                onSelectHelipad={onSelectHelipadAsStart}
              />
            )}
            {activeTab === 'route' && <RouteTab />}
            {activeTab === 'comms' && <CommsTab />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
