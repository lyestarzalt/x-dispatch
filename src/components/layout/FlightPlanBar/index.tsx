import { memo, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Navigation, Radio, Star, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import type { FlightPlanChip } from '@/types/fms';

// Minimum pixels moved to consider it a drag (not a click)
const DRAG_THRESHOLD = 5;

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

  // Drag-to-scroll refs (using refs to avoid re-renders)
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false); // True if mouse moved beyond threshold
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  // getChips() reads fmsData internally - component re-renders when fmsData changes
  const chips = getChips();

  const handleChipClick = useCallback(
    (chip: FlightPlanChip) => {
      // Don't trigger click if we actually dragged
      if (hasDraggedRef.current) return;
      setSelectedWaypoint(chip.waypointIndex ?? null);
      onWaypointClick?.(chip);
    },
    [setSelectedWaypoint, onWaypointClick]
  );

  const scrollLeft = useCallback(() => {
    scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  }, []);

  // Drag-to-scroll handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollRef.current.scrollLeft;
    // Change cursor immediately
    scrollRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const dx = e.clientX - dragStartX.current;

    // Mark as dragged if moved beyond threshold
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      hasDraggedRef.current = true;
    }

    scrollRef.current.scrollLeft = scrollStartX.current - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
    }
    // Reset hasDragged after a short delay to allow click to be blocked
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 0);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      if (scrollRef.current) {
        scrollRef.current.style.cursor = 'grab';
      }
    }
  }, []);

  if (!showFlightPlanBar || !fmsData) return null;

  return (
    <div className="flex h-10 items-center overflow-hidden rounded-lg border border-border bg-card/95 backdrop-blur-sm">
      {/* Close button — left side for easy access */}
      <Button
        variant="ghost"
        size="icon"
        onClick={clearFlightPlan}
        className="h-10 w-8 shrink-0 rounded-none border-r border-border text-muted-foreground hover:text-destructive"
        aria-label="Clear flight plan"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Left scroll button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={scrollLeft}
        className="h-10 w-8 shrink-0 rounded-none border-r border-border text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Scrollable chips area - drag to scroll */}
      <div
        ref={scrollRef}
        className="scrollbar-hidden flex flex-1 cursor-grab select-none items-center gap-1.5 overflow-x-auto px-2 py-1.5"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {chips.map((chip, index) => (
          <WaypointChip
            key={`${chip.type}-${chip.id}-${index}`}
            chip={chip}
            isActive={chip.waypointIndex === selectedWaypointIndex}
            onClick={() => handleChipClick(chip)}
          />
        ))}
      </div>

      {/* Right scroll button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={scrollRight}
        className="h-10 w-8 shrink-0 rounded-none border-l border-border text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Badge variant mapping for chip types
const CHIP_VARIANTS: Record<string, 'warning' | 'violet' | 'info' | 'outline'> = {
  departure: 'warning',
  arrival: 'warning',
  sid: 'violet',
  star: 'violet',
  vor: 'info',
  ndb: 'info',
  dme: 'info',
};

const CHIP_ICONS: Record<string, React.ReactNode> = {
  departure: <Star className="h-3 w-3" />,
  arrival: <MapPin className="h-3 w-3" />,
  sid: <Navigation className="h-3 w-3" />,
  star: <Navigation className="h-3 w-3" />,
  vor: <Radio className="h-3 w-3" />,
  ndb: <Radio className="h-3 w-3" />,
};

interface WaypointChipProps {
  chip: FlightPlanChip;
  isActive: boolean;
  onClick: () => void;
}

const WaypointChip = memo(function WaypointChip({ chip, isActive, onClick }: WaypointChipProps) {
  const variant = CHIP_VARIANTS[chip.type] || 'outline';
  const icon = CHIP_ICONS[chip.type];

  const label =
    chip.type === 'latlon' ? `${chip.latitude?.toFixed(1)}/${chip.longitude?.toFixed(1)}` : chip.id;

  // Show airway or flight level as suffix
  const suffix = useMemo(() => {
    if (chip.via && !['DRCT', 'ADEP', 'ADES'].includes(chip.via)) {
      return chip.via;
    }
    if (chip.altitude && chip.altitude > 1000) {
      return Math.round(chip.altitude / 100).toString();
    }
    return null;
  }, [chip.via, chip.altitude]);

  return (
    <Badge
      variant={variant}
      onClick={onClick}
      className={cn(
        'cursor-pointer gap-1 whitespace-nowrap px-2 py-0.5 text-[11px]',
        'transition-all hover:scale-[1.02] active:scale-[0.98]',
        isActive && 'ring-1 ring-info ring-offset-1 ring-offset-background'
      )}
    >
      {icon}
      <span>{label}</span>
      {suffix && <span className="opacity-60">{suffix}</span>}
    </Badge>
  );
});
