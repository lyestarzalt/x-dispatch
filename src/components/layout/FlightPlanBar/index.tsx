import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Mountain,
  Navigation,
  Radio,
  Star,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useMapStore } from '@/stores/mapStore';
import type { FlightPlanChip } from '@/types/fms';
import { type ScrollEdges, getScrollEdges, pageStep } from './scrollEdges';

// Minimum pixels moved to consider it a drag (not a click)
const DRAG_THRESHOLD = 5;

const NO_EDGES: ScrollEdges = { atStart: true, atEnd: true, overflows: false };

/** Every control on the bar: full height, no radius, hairline between neighbours. */
const RAIL_BUTTON = 'border-border h-10 w-9 shrink-0 rounded-none';

interface FlightPlanBarProps {
  onWaypointClick?: (chip: FlightPlanChip) => void;
}

function FlightPlanBar({ onWaypointClick }: FlightPlanBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const showFlightPlanBar = useFlightPlanStore((s) => s.showFlightPlanBar);
  const profileStripOpen = useMapStore((s) => s.profileStripOpen);
  const setProfileStripOpen = useMapStore((s) => s.setProfileStripOpen);
  const selectedWaypointIndex = useFlightPlanStore((s) => s.selectedWaypointIndex);
  const setSelectedWaypoint = useFlightPlanStore((s) => s.setSelectedWaypoint);
  const clearFlightPlan = useFlightPlanStore((s) => s.clearFlightPlan);
  const getChips = useFlightPlanStore((s) => s.getChips);
  const fmsData = useFlightPlanStore((s) => s.fmsData);

  // Which ends of the tape are in view: drives the rail buttons and the edge fades.
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES);

  // Drag-to-scroll refs (using refs to avoid re-renders)
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false); // True if mouse moved beyond threshold
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  // getChips() reads fmsData internally - component re-renders when fmsData changes
  const chips = getChips();
  const visible = showFlightPlanBar && fmsData !== null;

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = getScrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth);
    setEdges((prev) =>
      prev.atStart === next.atStart &&
      prev.atEnd === next.atEnd &&
      prev.overflows === next.overflows
        ? prev
        : next
    );
  }, []);

  // Track the edges through scrolling, resizing and plan changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !visible) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, chips.length, updateEdges]);

  // Bring the picked waypoint into view, e.g. after a click on the map or the profile.
  useEffect(() => {
    if (selectedWaypointIndex === null) return;
    const el = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedWaypointIndex]);

  const handleChipClick = useCallback(
    (chip: FlightPlanChip) => {
      // Don't trigger click if we actually dragged
      if (hasDraggedRef.current) return;
      setSelectedWaypoint(chip.waypointIndex ?? null);
      onWaypointClick?.(chip);
    },
    [setSelectedWaypoint, onWaypointClick]
  );

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * pageStep(el.clientWidth), behavior: 'smooth' });
  }, []);

  const jumpToStart = useCallback(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, []);

  const jumpToEnd = useCallback(() => {
    const el = scrollRef.current;
    el?.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, []);

  // A mouse wheel has no horizontal axis; let its vertical travel move the tape.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    el.scrollBy({ left: e.deltaY });
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

  if (!visible) return null;

  const clearLabel = t('flightPlanBar.clear');
  const jumpStartLabel = t('flightPlanBar.jumpToDeparture');
  const jumpEndLabel = t('flightPlanBar.jumpToArrival');
  const backLabel = t('flightPlanBar.scrollBack');
  const forwardLabel = t('flightPlanBar.scrollForward');
  const profileLabel = profileStripOpen ? t('profile.hide') : t('profile.show');

  return (
    <div className="border-border bg-card/95 flex h-10 items-center overflow-hidden rounded-lg border backdrop-blur-sm">
      {/* Close button — left side for easy access */}
      <Button
        variant="ghost"
        size="icon"
        onClick={clearFlightPlan}
        className={cn(RAIL_BUTTON, 'text-muted-foreground hover:text-destructive border-r')}
        aria-label={clearLabel}
        title={clearLabel}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Left rail: back to the departure, then one page back */}
      <Button
        variant="ghost"
        size="icon"
        onClick={jumpToStart}
        disabled={edges.atStart}
        className={cn(RAIL_BUTTON, 'text-muted-foreground hover:text-foreground border-r')}
        aria-label={jumpStartLabel}
        title={jumpStartLabel}
      >
        <ChevronFirst className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => scrollByPage(-1)}
        disabled={edges.atStart}
        className={cn(RAIL_BUTTON, 'text-muted-foreground hover:text-foreground border-r')}
        aria-label={backLabel}
        title={backLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Scrollable chips area - drag or wheel to scroll; fades show there is more */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          className="scrollbar-hidden flex cursor-grab items-center gap-2 overflow-x-auto px-3 py-1.5 select-none"
          onScroll={updateEdges}
          onWheel={handleWheel}
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
        <div
          aria-hidden
          className={cn(
            'from-card pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r to-transparent transition-opacity',
            edges.atStart ? 'opacity-0' : 'opacity-100'
          )}
        />
        <div
          aria-hidden
          className={cn(
            'from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent transition-opacity',
            edges.atEnd ? 'opacity-0' : 'opacity-100'
          )}
        />
      </div>

      {/* Right rail: one page forward, then on to the arrival */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => scrollByPage(1)}
        disabled={edges.atEnd}
        className={cn(RAIL_BUTTON, 'text-muted-foreground hover:text-foreground border-l')}
        aria-label={forwardLabel}
        title={forwardLabel}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={jumpToEnd}
        disabled={edges.atEnd}
        className={cn(RAIL_BUTTON, 'text-muted-foreground hover:text-foreground border-l')}
        aria-label={jumpEndLabel}
        title={jumpEndLabel}
      >
        <ChevronLast className="h-4 w-4" />
      </Button>

      {/* Vertical profile strip toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setProfileStripOpen(!profileStripOpen)}
        className={cn(
          RAIL_BUTTON,
          'border-l',
          profileStripOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
        aria-label={profileLabel}
        title={profileLabel}
      >
        <Mountain className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Badge variant mapping for chip types
const CHIP_VARIANTS: Record<string, 'warning' | 'cat-emerald' | 'cat-orange' | 'info' | 'outline'> =
  {
    departure: 'warning',
    arrival: 'warning',
    sid: 'cat-emerald',
    star: 'cat-orange',
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
      data-active={isActive ? 'true' : undefined}
      className={cn(
        'h-7 shrink-0 cursor-pointer gap-1.5 px-2.5 text-xs whitespace-nowrap',
        'transition-colors',
        isActive && 'ring-info ring-offset-background ring-1 ring-offset-1'
      )}
    >
      {icon}
      <span>{label}</span>
      {suffix && <span className="opacity-60">{suffix}</span>}
    </Badge>
  );
});

export default memo(FlightPlanBar);
