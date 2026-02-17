import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useAppStore } from '@/stores/appStore';
import type { Runway } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import AirportHeader from './components/AirportHeader';
import DepartureSelector from './components/DepartureSelector';
import FrequenciesSection from './sections/FrequenciesSection';
import ProceduresSection from './sections/ProceduresSection';
import VatsimSection from './sections/VatsimSection';

interface SidebarProps {
  onSelectRunway?: (runway: Runway) => void;
  onSelectGateAsStart?: (gate: NamedPosition) => void;
  onSelectRunwayEndAsStart?: (runwayEnd: NamedPosition) => void;
}

export default function Sidebar({
  onSelectRunway,
  onSelectGateAsStart,
  onSelectRunwayEndAsStart,
}: SidebarProps) {
  const { t } = useTranslation();

  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const metar = vatsimMetarData?.decoded ?? null;

  // Format weather as single line
  const weatherLine = useMemo(() => {
    if (!metar) return null;
    const parts: string[] = [];

    if (metar.temperature !== null) {
      parts.push(`${metar.temperature}°C`);
    }

    if (metar.wind) {
      const dir = metar.wind.direction === 'VRB' ? 'VRB' : `${metar.wind.direction}°`;
      const wind = metar.wind.gust
        ? `${dir}/${metar.wind.speed}G${metar.wind.gust}kt`
        : `${dir}/${metar.wind.speed}kt`;
      parts.push(wind);
    }

    if (metar.visibility) {
      const vis = metar.visibility;
      if (vis.unit === 'SM') {
        parts.push(`${vis.modifier === 'P' ? '>' : ''}${vis.value}SM`);
      } else {
        parts.push(
          `${vis.modifier === 'P' ? '>' : ''}${vis.value >= 9999 ? '>10' : vis.value / 1000}km`
        );
      }
    }

    return parts.length > 0 ? parts.join(' · ') : null;
  }, [metar]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!airport) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

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

        {/* Header */}
        <AirportHeader flightCategory={metar?.flightCategory} weatherLine={weatherLine} />

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-5 pb-5">
            {/* Departure Selector */}
            <DepartureSelector
              onSelectGate={(gate) => onSelectGateAsStart?.(gate)}
              onSelectRunwayEnd={(end) => onSelectRunwayEndAsStart?.(end)}
              onSelectRunway={onSelectRunway}
            />

            {/* Expandable sections - minimal treatment */}
            <div className="mt-8 space-y-1">
              <ExpandableSection
                title={t('sidebar.frequencies')}
                isExpanded={expandedSection === 'frequencies'}
                onToggle={() => toggleSection('frequencies')}
              >
                <FrequenciesSection />
              </ExpandableSection>

              <ExpandableSection
                title={t('sidebar.procedures')}
                isExpanded={expandedSection === 'procedures'}
                onToggle={() => toggleSection('procedures')}
              >
                <ProceduresSection />
              </ExpandableSection>

              <ExpandableSection
                title="VATSIM"
                isExpanded={expandedSection === 'vatsim'}
                onToggle={() => toggleSection('vatsim')}
              >
                <VatsimSection />
              </ExpandableSection>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface ExpandableSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ExpandableSection({ title, isExpanded, onToggle, children }: ExpandableSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-180')}
        />
      </button>
      {isExpanded && <div className="pb-4 pt-2">{children}</div>}
    </div>
  );
}
