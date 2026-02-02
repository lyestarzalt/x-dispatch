import { useTranslation } from 'react-i18next';
import { Info, Radar, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { SettingsSectionProps } from '../types';

interface VatsimSectionProps extends SettingsSectionProps {
  isVatsimEnabled: boolean;
  onToggleVatsim: () => void;
  vatsimPilotCount?: number;
}

export default function VatsimSection({
  className,
  isVatsimEnabled,
  onToggleVatsim,
  vatsimPilotCount,
}: VatsimSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Radar className="h-5 w-5 text-green-500" />
          {t('settings.navigation.vatsim.title', 'VATSIM')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.navigation.vatsim.sectionDescription',
            'Live air traffic from the VATSIM network'
          )}
        </p>
      </div>

      <Separator />

      {/* Enable/Disable Card */}
      <Card className={cn(isVatsimEnabled && 'border-green-500/30')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium">
                {t('settings.navigation.vatsim.enable', 'Enable VATSIM Overlay')}
              </CardTitle>
              <CardDescription>
                {t(
                  'settings.navigation.vatsim.description',
                  'Show live pilot positions on the map'
                )}
              </CardDescription>
            </div>
            <Switch id="vatsim-toggle" checked={isVatsimEnabled} onCheckedChange={onToggleVatsim} />
          </div>
        </CardHeader>
        {isVatsimEnabled && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm">
                {t('settings.navigation.vatsim.currentlyOnline', 'Currently Online')}:
              </span>
              <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                {vatsimPilotCount !== undefined
                  ? `${vatsimPilotCount.toLocaleString()} pilots`
                  : 'Loading...'}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Info Cards */}
      {isVatsimEnabled && (
        <>
          {/* Refresh Rate Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <RefreshCw className="h-4 w-4" />
                {t('settings.navigation.vatsim.refreshRate', 'Refresh Rate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {t('settings.navigation.vatsim.autoRefresh', 'Auto-refresh interval')}
                </span>
                <Badge variant="secondary" className="font-mono">
                  15s
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  'settings.navigation.vatsim.refreshNote',
                  'VATSIM data is refreshed every 15 seconds to comply with API guidelines.'
                )}
              </p>
            </CardContent>
          </Card>

          {/* Usage Info */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="flex items-start gap-3 pt-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <div className="space-y-1 text-xs text-blue-400">
                <p className="font-medium">
                  {t('settings.navigation.vatsim.aboutTitle', 'About VATSIM Integration')}
                </p>
                <p className="text-blue-400/80">
                  {t(
                    'settings.navigation.vatsim.aboutDescription',
                    'Pilots are displayed as icons on the map. Click on a pilot to see their flight details including callsign, aircraft, departure, and destination.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
