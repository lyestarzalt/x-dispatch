import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Compass, Info, PlaneTakeoff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [activeTab, setActiveTab] = useState<TabId>('info');

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
              <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
                {airport.id}
              </h1>
              <span className="font-mono text-xs text-muted-foreground">
                {elevation}' {transitionAlt && `TA${transitionAlt}'`}
              </span>
            </div>
            {flightCategory && (
              <Badge
                variant="outline"
                className={cn(
                  'px-2 py-0.5 font-mono text-xs font-bold',
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

          {/* Row 2: Airport Name + IATA */}
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-sm text-foreground">{airport.name}</p>
            {airport.metadata.iata_code && airport.metadata.iata_code !== airport.id && (
              <span className="font-mono text-xs text-muted-foreground">
                ({airport.metadata.iata_code})
              </span>
            )}
          </div>

          {/* Row 3: Location */}
          {(airport.metadata.city || airport.metadata.country) && (
            <p className="text-xs text-muted-foreground">
              {[airport.metadata.city, airport.metadata.state || airport.metadata.country]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>

        {/* Selected position indicator */}
        {selectedStartPosition && (
          <div className="flex items-center justify-between border-b border-border/30 bg-emerald-500/5 px-4 py-2">
            <span className="text-xs text-emerald-400/70">{t('airportInfo.tabs.start')}</span>
            <span className="font-mono text-sm font-medium text-emerald-400">
              {selectedStartPosition.name}
            </span>
          </div>
        )}

        {/* Tab Navigation - Compact */}
        <div className="flex border-b border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              <span>{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeTab === 'info' && <InfoTab />}
            {activeTab === 'start' && (
              <StartTab
                onSelectGate={onSelectGateAsStart}
                onSelectRunwayEnd={onSelectRunwayEndAsStart}
                onSelectRunway={onSelectRunway}
                onSelectHelipad={onSelectHelipadAsStart}
              />
            )}
            {activeTab === 'proc' && <RouteTab />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
