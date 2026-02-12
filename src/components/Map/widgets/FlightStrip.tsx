import { useTranslation } from 'react-i18next';
import { Crosshair, Plane, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

function formatVS(vs: number | undefined): string {
  if (vs === undefined || isNaN(vs)) return '---';
  const rounded = Math.round(vs / 100) * 100;
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export default function FlightStrip({ planeState, connected, onCenterPlane }: FlightStripProps) {
  const { t } = useTranslation();

  // Disconnected state
  if (!connected) {
    return (
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <Card className="flex h-10 items-center gap-2 border-destructive/50 px-4">
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-sm text-muted-foreground">{t('flightStrip.notDetected')}</span>
        </Card>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <Card className="flex h-10 items-center gap-px p-0">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <Plane className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>

        <Separator />

        <DataBlock
          label={t('flightStrip.ias')}
          value={formatValue(planeState?.indicatedAirspeed)}
          unit={t('units.kt')}
        />
        <Separator />
        <DataBlock
          label={t('flightStrip.gs')}
          value={formatValue(planeState?.groundspeed)}
          unit={t('units.kt')}
        />
        <Separator />
        <DataBlock
          label={t('flightStrip.alt')}
          value={formatValue(planeState?.altitudeMSL)}
          unit={t('units.ft')}
        />
        <Separator />
        <DataBlock
          label={t('flightStrip.agl')}
          value={formatValue(planeState?.altitudeAGL)}
          unit={t('units.ft')}
        />
        <Separator />
        <DataBlock
          label={t('flightStrip.vs')}
          value={formatVS(planeState?.verticalSpeed)}
          unit={t('units.fpm')}
        />
        <Separator />
        <DataBlock
          label={t('flightStrip.hdg')}
          value={formatHeading(planeState?.heading)}
          unit="°"
        />
        <Separator />

        <Button
          variant="ghost"
          size="sm"
          onClick={onCenterPlane}
          className="h-full rounded-l-none rounded-r-lg"
          title={t('flightStrip.centerTooltip')}
        >
          <Crosshair className="mr-1.5 h-3.5 w-3.5" />
          {t('flightStrip.center')}
        </Button>
      </Card>
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
