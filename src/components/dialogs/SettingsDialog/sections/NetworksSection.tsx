import { Globe, Info, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/helpers';
import type { SettingsSectionProps } from '../types';

interface NetworksSectionProps extends SettingsSectionProps {
  isVatsimEnabled: boolean;
  onToggleVatsim: () => void;
  vatsimPilotCount?: number;
  isIvaoEnabled: boolean;
  onToggleIvao: () => void;
  ivaoPilotCount?: number;
}

export default function NetworksSection({
  className,
  isVatsimEnabled,
  onToggleVatsim,
  vatsimPilotCount,
  isIvaoEnabled,
  onToggleIvao,
  ivaoPilotCount,
}: NetworksSectionProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Globe className="h-5 w-5" />
          Online Networks
        </h3>
        <p className="text-sm text-muted-foreground">
          Live air traffic from online flying networks. Only one network can be active at a time.
        </p>
      </div>

      <Separator />

      {/* VATSIM Card */}
      <Card className={cn(isVatsimEnabled && 'border-success/30')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-success" />
                VATSIM
              </CardTitle>
              <CardDescription>Show live pilot positions from the VATSIM network</CardDescription>
            </div>
            <Switch id="vatsim-toggle" checked={isVatsimEnabled} onCheckedChange={onToggleVatsim} />
          </div>
        </CardHeader>
        {isVatsimEnabled && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-success" />
              <span className="text-sm">Currently Online:</span>
              <Badge variant="success">
                {vatsimPilotCount !== undefined
                  ? `${vatsimPilotCount.toLocaleString()} pilots`
                  : 'Loading...'}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* IVAO Card */}
      <Card className={cn(isIvaoEnabled && 'border-cat-blue/30')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-cat-blue" />
                IVAO
              </CardTitle>
              <CardDescription>Show live pilot positions from the IVAO network</CardDescription>
            </div>
            <Switch id="ivao-toggle" checked={isIvaoEnabled} onCheckedChange={onToggleIvao} />
          </div>
        </CardHeader>
        {isIvaoEnabled && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cat-blue" />
              <span className="text-sm">Currently Online:</span>
              <Badge className="bg-cat-blue/20 text-cat-blue">
                {ivaoPilotCount !== undefined
                  ? `${ivaoPilotCount.toLocaleString()} pilots`
                  : 'Loading...'}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Info Cards (shown when either network is active) */}
      {(isVatsimEnabled || isIvaoEnabled) && (
        <>
          {/* Refresh Rate Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <RefreshCw className="h-4 w-4" />
                Refresh Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">Auto-refresh interval</span>
                <Badge variant="secondary" className="font-mono">
                  15s
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Network data is refreshed every 15 seconds to comply with API guidelines.
              </p>
            </CardContent>
          </Card>

          {/* Usage Info */}
          <Card className="border-info/20 bg-info/5">
            <CardContent className="flex items-start gap-3 pt-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <div className="space-y-1 text-xs text-info">
                <p className="font-medium">About Online Networks</p>
                <p className="text-info/80">
                  Pilots are displayed as icons on the map. Click on a pilot to see their flight
                  details including callsign, aircraft, departure, and destination. Only one network
                  can be active at a time &mdash; enabling one will disable the other.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
