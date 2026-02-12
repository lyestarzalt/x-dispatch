import { Crosshair, Plane, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlaneState } from '@/types/xplane';

interface FlightStripProps {
  planeState: Partial<PlaneState> | null;
  connected: boolean;
  onCenterPlane: () => void;
}

function formatValue(value: number | undefined, decimals = 0): string {
  if (value === undefined || isNaN(value)) return '---';
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatHeading(heading: number | undefined): string {
  if (heading === undefined || isNaN(heading)) return '---';
  const normalized = ((heading % 360) + 360) % 360;
  return normalized.toFixed(0).padStart(3, '0');
}

export default function FlightStrip({ planeState, connected, onCenterPlane }: FlightStripProps) {
  // Disconnected state
  if (!connected) {
    return (
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-destructive/50 bg-card/95 px-4 backdrop-blur-sm">
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-sm text-muted-foreground">X-Plane not detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="flex h-10 items-center gap-px rounded-lg border border-border bg-card/95 backdrop-blur-sm">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <Plane className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>

        <Separator />

        {/* IAS */}
        <DataBlock label="IAS" value={formatValue(planeState?.indicatedAirspeed)} unit="kt" />

        <Separator />

        {/* Ground Speed */}
        <DataBlock label="GS" value={formatValue(planeState?.groundspeed)} unit="kt" />

        <Separator />

        {/* Altitude */}
        <DataBlock label="ALT" value={formatValue(planeState?.altitudeMSL)} unit="ft" />

        <Separator />

        {/* Heading */}
        <DataBlock label="HDG" value={formatHeading(planeState?.heading)} unit="°" />

        <Separator />

        {/* Center Button */}
        <button
          onClick={onCenterPlane}
          className={cn(
            'flex h-full items-center gap-1.5 px-3',
            'text-xs text-muted-foreground hover:bg-accent/50 hover:text-primary',
            'rounded-r-lg transition-colors'
          )}
          title="Center map on plane"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Center</span>
        </button>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="h-6 w-px bg-border" />;
}

interface DataBlockProps {
  label: string;
  value: string;
  unit: string;
}

function DataBlock({ label, value, unit }: DataBlockProps) {
  return (
    <div className="flex items-baseline gap-1.5 px-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{unit}</span>
    </div>
  );
}
