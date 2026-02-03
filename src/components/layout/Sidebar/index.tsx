import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Radio, Route } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ParsedAirport } from '@/lib/aptParser';
import { FrequencyType, Runway } from '@/lib/aptParser/types';
import { FeatureDebugInfo } from '@/stores/mapStore';
import { NamedPosition, Position } from '@/types/geo';
import { WeatherData } from '@/types/weather';
import AirportHeader from './components/AirportHeader';
import DepartureSelector from './components/DepartureSelector';
import QuickWeather from './components/QuickWeather';
import FrequenciesSection from './sections/FrequenciesSection';
import ProceduresSection, { Procedure } from './sections/ProceduresSection';
import WeatherDetails from './sections/WeatherDetails';

interface SidebarProps {
  airport: ParsedAirport | null;
  onCloseAirport: () => void;
  weather: WeatherData;
  gatewayInfo?: unknown;
  onRefreshGateway?: () => void;
  layerVisibility: unknown;
  onLayerToggle: (layer: string) => void;
  navVisibility: unknown;
  onNavToggle: (layer: string) => void;
  onLoadViewportNavaids: () => void;
  isLoadingNav: boolean;
  navDataCounts: {
    vors: number;
    ndbs: number;
    dmes: number;
    ils: number;
    waypoints: number;
    airspaces: number;
    highAirways: number;
    lowAirways: number;
  };
  onNavigateToGate?: (gate: Position & { heading: number }) => void;
  onSelectRunway?: (runway: Runway) => void;
  debugEnabled?: boolean;
  onDebugToggle?: () => void;
  selectedFeature?: FeatureDebugInfo | null;
  onClearSelectedFeature?: () => void;
  onSelectProcedure?: (procedure: Procedure) => void;
  selectedProcedure?: Procedure | null;
  onSelectGateAsStart?: (gate: NamedPosition) => void;
  onSelectRunwayEndAsStart?: (runwayEnd: NamedPosition) => void;
  selectedStartPosition?: { type: 'runway' | 'ramp'; name: string } | null;
}

export default function Sidebar({
  airport,
  onCloseAirport,
  weather,
  navDataCounts,
  onSelectRunway,
  onSelectProcedure,
  selectedProcedure,
  onSelectGateAsStart,
  onSelectRunwayEndAsStart,
  selectedStartPosition,
}: SidebarProps) {
  const { t } = useTranslation();

  const metar = weather.metar?.decoded;

  // Get ATIS frequency for quick weather display
  const frequencies = airport?.frequencies;
  const atisFrequency = useMemo(() => {
    if (!frequencies) return null;
    return frequencies.find((f) => f.type === FrequencyType.AWOS) || null;
  }, [frequencies]);

  if (!airport) return null;

  return (
    <div className="absolute bottom-4 right-4 top-20 z-20 w-80">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-sm">
        {/* Header */}
        <AirportHeader
          airport={airport}
          flightCategory={metar?.flightCategory}
          onClose={onCloseAirport}
          selectedStartPosition={selectedStartPosition}
        />

        {/* Scrollable content */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3">
            {/* Quick Weather Strip */}
            <QuickWeather metar={metar} atisFrequency={atisFrequency} />

            {/* Departure Position Selector - Primary action */}
            <DepartureSelector
              runways={airport.runways}
              gates={airport.startupLocations || []}
              onSelectGate={(gate) => onSelectGateAsStart?.(gate)}
              onSelectRunwayEnd={(end) => onSelectRunwayEndAsStart?.(end)}
              onSelectRunway={onSelectRunway}
              selectedStartPosition={selectedStartPosition}
              ilsCount={navDataCounts.ils}
            />

            {/* Accordion sections for secondary info */}
            <Accordion type="multiple" className="w-full">
              {/* Weather Details */}
              <AccordionItem value="weather" className="border-border/50">
                <AccordionTrigger className="py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-3.5 w-3.5 text-blue-400" />
                    <span>{t('sidebar.weatherDetails')}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0">
                  <WeatherDetails metar={metar} metarRaw={weather.metar?.raw} taf={weather.taf} />
                </AccordionContent>
              </AccordionItem>

              {/* Frequencies */}
              <AccordionItem value="frequencies" className="border-border/50">
                <AccordionTrigger className="py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-green-400" />
                    <span>{t('sidebar.frequencies')}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({airport.frequencies.length})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0">
                  <FrequenciesSection frequencies={airport.frequencies} airportIcao={airport.id} />
                </AccordionContent>
              </AccordionItem>

              {/* Procedures */}
              <AccordionItem value="procedures" className="border-border/50">
                <AccordionTrigger className="py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Route className="h-3.5 w-3.5 text-purple-400" />
                    <span>{t('sidebar.procedures')}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0">
                  <ProceduresSection
                    icao={airport.id}
                    onSelectProcedure={onSelectProcedure || (() => {})}
                    selectedProcedure={selectedProcedure || null}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
