import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Navigation, Radio, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/helpers';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import type { FlightPlanChip } from '@/types/fms';

interface FlightPlanBarProps {
  onWaypointClick?: (chip: FlightPlanChip) => void;
}

export default function FlightPlanBar({ onWaypointClick }: FlightPlanBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const showFlightPlanBar = useFlightPlanStore((s) => s.showFlightPlanBar);
  const selectedWaypointIndex = useFlightPlanStore((s) => s.selectedWaypointIndex);
  const setSelectedWaypoint = useFlightPlanStore((s) => s.setSelectedWaypoint);
  const clearFlightPlan = useFlightPlanStore((s) => s.clearFlightPlan);
  const getChips = useFlightPlanStore((s) => s.getChips);
  const fmsData = useFlightPlanStore((s) => s.fmsData);

  const chips = getChips();

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  const handleChipClick = useCallback(
    (chip: FlightPlanChip, index: number) => {
      setSelectedWaypoint(chip.waypointIndex ?? null);
      onWaypointClick?.(chip);
    },
    [setSelectedWaypoint, onWaypointClick]
  );

  if (!showFlightPlanBar || !fmsData) return null;

  // Calculate progress (selected waypoint position)
  const progressPercent =
    selectedWaypointIndex !== null && chips.length > 0
      ? ((selectedWaypointIndex + 1) / chips.length) * 100
      : 0;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40">
      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        {/* Waypoint chips row */}
        <div className="flex h-10 items-center gap-1 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleScroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            ref={scrollRef}
            className="scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto"
          >
            {chips.map((chip, index) => (
              <WaypointChip
                key={`${chip.type}-${chip.id}-${index}`}
                chip={chip}
                isActive={chip.waypointIndex === selectedWaypointIndex}
                onClick={() => handleChipClick(chip, index)}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleScroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={clearFlightPlan}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress line */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-info transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>
    </div>
  );
}

interface WaypointChipProps {
  chip: FlightPlanChip;
  isActive: boolean;
  onClick: () => void;
}

function WaypointChip({ chip, isActive, onClick }: WaypointChipProps) {
  const getChipStyle = () => {
    switch (chip.type) {
      case 'departure':
      case 'arrival':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'sid':
      case 'star':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'vor':
      case 'ndb':
        return 'bg-info/20 text-info border-info/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getIcon = () => {
    switch (chip.type) {
      case 'departure':
        return <Star className="h-3 w-3" />;
      case 'arrival':
        return <MapPin className="h-3 w-3" />;
      case 'sid':
      case 'star':
        return <Navigation className="h-3 w-3" />;
      case 'vor':
      case 'ndb':
        return <Radio className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    if (chip.type === 'latlon') {
      return `${chip.latitude?.toFixed(2)}/${chip.longitude?.toFixed(2)}`;
    }
    return chip.id;
  };

  const getSubLabel = () => {
    if (chip.via && chip.via !== 'DRCT' && chip.via !== 'ADEP' && chip.via !== 'ADES') {
      return chip.via;
    }
    if (chip.altitude && chip.altitude > 1000) {
      return `FL${Math.round(chip.altitude / 100)}`;
    }
    return null;
  };

  const subLabel = getSubLabel();

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-all',
        getChipStyle(),
        isActive && 'ring-2 ring-info ring-offset-1 ring-offset-background'
      )}
    >
      {getIcon()}
      <span>{getLabel()}</span>
      {subLabel && <span className="text-[10px] opacity-70">{subLabel}</span>}
    </button>
  );
}
