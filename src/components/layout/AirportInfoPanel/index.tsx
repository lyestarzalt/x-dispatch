import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Compass, Info, PlaneTakeoff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/helpers';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import type { Runway } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import InfoTab from './tabs/InfoTab';
import RouteTab from './tabs/RouteTab';
import StartTab from './tabs/StartTab';

type TabId = 'info' | 'start' | 'proc';

interface Tab {
  id: TabId;
  icon: React.ReactNode;
  labelKey: string;
}

const TABS: Tab[] = [
  { id: 'info', labelKey: 'airportInfo.tabs.info', icon: <Info className="h-4 w-4" /> },
  { id: 'start', labelKey: 'airportInfo.tabs.start', icon: <PlaneTakeoff className="h-4 w-4" /> },
  { id: 'proc', labelKey: 'airportInfo.tabs.proc', icon: <Compass className="h-4 w-4" /> },
];

interface AirportInfoPanelProps {
  onSelectRunway?: (runway: Runway) => void;
  onSelectGateAsStart?: (gate: NamedPosition) => void;
  onSelectRunwayEndAsStart?: (runwayEnd: NamedPosition) => void;
  onSelectHelipadAsStart?: (helipad: NamedPosition) => void;
}

export default function AirportInfoPanel({
  onSelectRunway,
  onSelectGateAsStart,
  onSelectRunwayEndAsStart,
  onSelectHelipadAsStart,
}: AirportInfoPanelProps) {
  const { t } = useTranslation();
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const selectedStartPosition = useAppStore((s) => s.startPosition);
  const showFlightPlanBar = useFlightPlanStore((s) => s.showFlightPlanBar);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const flightCategory = vatsimMetarData?.flightCategory ?? null;

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!airport) return null;

  const elevation = Math.round(airport.elevation);
  const transitionAlt = airport.metadata.transition_alt;

  return (
    <div
      className={cn(
        'absolute bottom-4 right-4 z-20 transition-all duration-300 ease-out',
        showFlightPlanBar ? 'top-28' : 'top-16',
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

        {/* Header - Dense pilot info */}
        <div className="border-b border-border/30 px-4 pb-3 pt-4">
          {/* Row 1: ICAO + Flight Category */}
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-baseline gap-2">
              <h1 className="font-mono text-xl font-bold tracking-tight text-info">{airport.id}</h1>
              <span className="font-mono text-xs text-muted-foreground">
                {elevation}' {transitionAlt && `TA${transitionAlt}'`}
              </span>
            </div>
            {flightCategory && (
              <Badge
                variant={
                  flightCategory === 'VFR'
                    ? 'cat-emerald'
                    : flightCategory === 'MVFR'
                      ? 'cat-sky'
                      : flightCategory === 'IFR'
                        ? 'cat-red'
                        : 'cat-fuchsia'
                }
                className="px-2 py-0.5 font-mono text-xs font-bold"
              >
                {flightCategory}
              </Badge>
            )}
          </div>

          {/* Row 2: Airport Name + IATA */}
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-sm text-muted-foreground">{airport.name}</p>
            {airport.metadata.iata_code && airport.metadata.iata_code !== airport.id && (
              <span className="font-mono text-xs text-muted-foreground">
                ({airport.metadata.iata_code})
              </span>
            )}
          </div>

          {/* Row 3: Location */}
          {(airport.metadata.city || airport.metadata.country) && (
            <p className="text-sm text-muted-foreground">
              {[airport.metadata.city, airport.metadata.state || airport.metadata.country]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>

        {/* Selected position indicator */}
        {selectedStartPosition && (
          <div className="flex items-center justify-between border-b border-border/30 bg-cat-emerald/5 px-4 py-2">
            <span className="text-xs text-cat-emerald/70">{t('airportInfo.tabs.start')}</span>
            <span className="font-mono text-sm font-medium text-cat-emerald">
              {selectedStartPosition.name}
            </span>
          </div>
        )}

        {/* Tab Navigation + Content */}
        <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
          <TabsList variant="line" className="border-border/30">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-1 gap-1.5 text-xs">
                {tab.icon}
                <span>{t(tab.labelKey)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <TabsContent value="info" className="mt-0">
                <InfoTab />
              </TabsContent>
              <TabsContent value="start" className="mt-0">
                <StartTab
                  onSelectGate={onSelectGateAsStart}
                  onSelectRunwayEnd={onSelectRunwayEndAsStart}
                  onSelectRunway={onSelectRunway}
                  onSelectHelipad={onSelectHelipadAsStart}
                />
              </TabsContent>
              <TabsContent value="proc" className="mt-0">
                <RouteTab />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
