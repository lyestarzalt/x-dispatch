import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Fuel,
  Maximize2,
  Plane,
  Route,
  Scale,
  X,
} from 'lucide-react';
import { SimbriefLogo } from '@/components/ui/SimbriefLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/helpers';
import { formatDistance } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { FuelTab } from './FuelTab';
import { OverviewTab } from './OverviewTab';
import { WeatherTab } from './WeatherTab';
import { WeightsTab } from './WeightsTab';

type TabId = 'overview' | 'fuel' | 'weights' | 'weather';

interface Tab {
  id: TabId;
  icon: React.ReactNode;
  label: string;
}

function FlightInfoPanel() {
  const { t } = useTranslation();
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);
  const clearFlightPlan = useFlightPlanStore((s) => s.clearFlightPlan);
  const openSimbriefDialog = useFlightPlanStore((s) => s.openSimbriefDialog);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: t('flightInfoPanel.tabs.route'),
      icon: <Route className="h-4 w-4" />,
    },
    { id: 'fuel', label: t('flightInfoPanel.tabs.fuel'), icon: <Fuel className="h-4 w-4" /> },
    {
      id: 'weights',
      label: t('flightInfoPanel.tabs.weight'),
      icon: <Scale className="h-4 w-4" />,
    },
    { id: 'weather', label: t('flightInfoPanel.tabs.wx'), icon: <Cloud className="h-4 w-4" /> },
  ];

  if (!simbriefData) {
    return null;
  }

  const apiUnit = simbriefData.params.units;
  const flightNumber = simbriefData.general.icao_airline
    ? `${simbriefData.general.icao_airline}${simbriefData.general.flight_number}`
    : simbriefData.atc.callsign;

  return (
    <div
      className={cn(
        'absolute left-4 z-30 transition-all duration-300 ease-out',
        isCollapsed
          ? 'top-28 w-12' // Position below toolbar when collapsed
          : 'top-1/2 w-80 -translate-y-1/2' // Vertically centered when expanded
      )}
    >
      <div
        className={cn(
          'border-border/40 bg-card/95 relative flex flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm transition-all duration-300',
          isCollapsed ? 'h-44' : 'max-h-[calc(100vh-120px)]'
        )}
      >
        {/* Collapsed state */}
        <div
          className={cn(
            'bg-card/95 absolute inset-0 z-20 flex flex-col items-center py-5 transition-opacity duration-200',
            isCollapsed ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="mb-4 h-8 w-8"
            onClick={() => setIsCollapsed(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span
            className="text-foreground font-mono text-sm font-bold tracking-wider"
            style={{ writingMode: 'vertical-rl' }}
          >
            {flightNumber}
          </span>
        </div>

        {/* Control Buttons */}
        <div
          className={cn(
            'border-border/30 flex items-center justify-end border-b px-1 py-1',
            isCollapsed && 'opacity-0'
          )}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/40 hover:text-foreground"
              onClick={openSimbriefDialog}
              tooltip={t('simbrief.openFullBriefing')}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/40 hover:text-foreground"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={clearFlightPlan}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className={cn('border-border/30 border-b px-4 pt-3 pb-3', isCollapsed && 'opacity-0')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SimbriefLogo size="xs" className="opacity-70" />
              <Badge variant="secondary" className="font-mono text-xs font-bold">
                {flightNumber}
              </Badge>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground font-mono text-sm">
                {simbriefData.aircraft.icao_code}
              </span>
            </div>
          </div>

          {/* Route Display */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="text-center">
              <Button
                variant="link"
                onClick={() =>
                  useAppStore.getState().requestSelectAirport(simbriefData.origin.icao_code)
                }
                className="h-auto p-0 font-mono text-lg font-bold tracking-tight"
                aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                  icao: simbriefData.origin.icao_code,
                })}
              >
                {simbriefData.origin.icao_code}
              </Button>
              <p className="text-muted-foreground text-2xs">
                {t('simbriefDialog.header.runway', { rwy: simbriefData.origin.plan_rwy })}
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <div className="to-border h-px w-8 bg-gradient-to-r from-transparent" />
                <Plane className="text-primary h-3.5 w-3.5 rotate-90" />
                <div className="to-border h-px w-8 bg-gradient-to-l from-transparent" />
              </div>
              <span className="text-muted-foreground text-2xs font-mono">
                {formatDistance(simbriefData.general.air_distance)}
              </span>
            </div>
            <div className="text-center">
              <Button
                variant="link"
                onClick={() =>
                  useAppStore.getState().requestSelectAirport(simbriefData.destination.icao_code)
                }
                className="h-auto p-0 font-mono text-lg font-bold tracking-tight"
                aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                  icao: simbriefData.destination.icao_code,
                })}
              >
                {simbriefData.destination.icao_code}
              </Button>
              <p className="text-muted-foreground text-2xs">
                {t('simbriefDialog.header.runway', { rwy: simbriefData.destination.plan_rwy })}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation + Content */}
        <Tabs
          defaultValue="overview"
          className={cn('flex min-h-0 flex-1 flex-col', isCollapsed && 'opacity-0')}
        >
          <TabsList variant="line" className="border-border/30">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-2xs min-w-0 flex-1 gap-1">
                {tab.icon}
                <span className="hidden min-w-0 truncate sm:block">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="p-3">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab data={simbriefData} apiUnit={apiUnit} />
              </TabsContent>
              <TabsContent value="fuel" className="mt-0">
                <FuelTab data={simbriefData} apiUnit={apiUnit} />
              </TabsContent>
              <TabsContent value="weights" className="mt-0">
                <WeightsTab data={simbriefData} apiUnit={apiUnit} />
              </TabsContent>
              <TabsContent value="weather" className="mt-0">
                <WeatherTab data={simbriefData} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}

export default memo(FlightInfoPanel);
