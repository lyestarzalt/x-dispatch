import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  CheckCircle2,
  Database,
  Layers,
  MapPin,
  Navigation,
  Plane,
  Radio,
  RefreshCw,
  Route,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/helpers';
import { useLoadingStatus } from '@/queries';
import type { SettingsSectionProps } from '../types';

type SourceType = 'navigraph' | 'xplane-default' | 'custom-scenery' | 'unknown';
type SettingsDataLoadStatus = NonNullable<
  Awaited<ReturnType<typeof window.appAPI.getLoadingStatus>>['status']
>;

interface DataRowProps {
  label: string;
  count: number;
  source: string | null;
  sourceType?: SourceType;
  icon?: React.ReactNode;
}

function getSourceLabel(sourceType: SourceType | undefined, source: string | null): string {
  if (sourceType === 'navigraph') return 'Navigraph';
  if (sourceType === 'xplane-default') return 'X-Plane Default';
  if (sourceType === 'custom-scenery') return 'Custom Airport';
  // Fallback: detect from path
  if (source?.includes('Custom Data')) return 'Navigraph';
  if (source?.includes('Custom Scenery')) return 'Custom Airport';
  if (source?.includes('default data')) return 'X-Plane Default';
  return 'Default';
}

function getSourceStyles(sourceType: SourceType | undefined, source: string | null): string {
  const label = getSourceLabel(sourceType, source);
  if (label === 'Navigraph') return 'bg-info/20 text-info hover:bg-info/30';
  if (label === 'Custom Airport') return 'bg-violet/20 text-violet hover:bg-violet/30';
  return ''; // Default secondary style
}

function DataRow({ label, count, source, sourceType, icon }: DataRowProps) {
  const displaySource = getSourceLabel(sourceType, source);
  const isHighlighted = displaySource !== 'X-Plane Default' && displaySource !== 'Default';
  const sourceStyles = getSourceStyles(sourceType, source);

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {icon}
          {label}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {count > 0 ? count.toLocaleString() : '-'}
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={isHighlighted ? 'default' : 'secondary'}
              className={cn('cursor-help font-normal', sourceStyles)}
            >
              {displaySource}
            </Badge>
          </TooltipTrigger>
          {source && (
            <TooltipContent side="left" className="max-w-xs">
              <p className="break-all font-mono text-xs">{source}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

export default function NavigationDataSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { data: loadingResult } = useLoadingStatus();
  const dataStatus = loadingResult?.status as SettingsDataLoadStatus | undefined;
  const [isClearing, setIsClearing] = useState(false);

  const globalSource = dataStatus?.sources?.global;
  const isNavigraph = globalSource?.source === 'navigraph';
  const airportBreakdown = dataStatus?.airports?.breakdown;

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await window.appAPI.clearCache();
      // Trigger reload by starting loading again
      await window.appAPI.startLoading();
      // Reload page to refresh all data
      window.location.reload();
    } catch (error) {
      window.appAPI.log.error('Failed to clear cache', error);
      setIsClearing(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Database className="h-5 w-5" />
          {t('settings.navigation.dataTitle', 'Navigation Data')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.navigation.dataDescription', 'View loaded navigation data sources')}
        </p>
      </div>

      <Separator />

      {/* Airport Layout Data */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading flex items-center gap-2">
            <Plane className="h-4 w-4" />
            {t('settings.navigation.airportLayoutData')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.navigation.airportLayoutDescription')}
          </p>
        </div>
        {dataStatus && airportBreakdown && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {t('settings.navigation.globalAirports')}
                </div>
                <div className="mt-1 font-mono text-lg font-semibold">
                  {airportBreakdown.globalAirports.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('settings.navigation.customAirports')}
                </div>
                <div className="mt-1 font-mono text-lg font-semibold">
                  {airportBreakdown.customScenery.toLocaleString()}
                </div>
                {airportBreakdown.customSceneryPacks > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t('settings.navigation.fromSceneryPacks', {
                      count: airportBreakdown.customSceneryPacks,
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {t('settings.navigation.totalAirports')}
              </span>
              <span className="font-mono font-medium">
                {dataStatus.airports.count.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Navigation Data Source */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading flex items-center gap-2">
            <Radio className="h-4 w-4" />
            {t('settings.navigation.navDataSource')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.navigation.navDataSourceDescription')}
          </p>
        </div>
        {globalSource && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isNavigraph ? (
                <Badge className="bg-info hover:bg-info/80">Navigraph</Badge>
              ) : (
                <Badge variant="secondary">X-Plane Default</Badge>
              )}
              {globalSource.cycle && (
                <span className="font-mono text-sm text-muted-foreground">
                  AIRAC {globalSource.cycle}
                  {globalSource.revision && `.${globalSource.revision}`}
                </span>
              )}
            </div>
            {isNavigraph && (
              <Badge variant={globalSource.isExpired ? 'destructive' : 'success'} className="gap-1">
                {globalSource.isExpired ? (
                  <>
                    <XCircle className="h-3 w-3" />
                    {t('settings.xplane.expired', 'Expired')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    {t('settings.xplane.current', 'Current')}
                  </>
                )}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Navigation Data Table */}
      {dataStatus && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="xp-section-heading">{t('settings.xplane.dataLoaded', 'Loaded Data')}</h3>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.xplane.dataType', 'Type')}</TableHead>
                    <TableHead className="text-right">
                      {t('settings.xplane.count', 'Count')}
                    </TableHead>
                    <TableHead>{t('settings.xplane.source', 'Source')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <DataRow
                    label={t('loading.steps.navaids', 'Navaids')}
                    count={dataStatus.navaids.count}
                    source={dataStatus.navaids.source}
                    sourceType={dataStatus.sources?.navaids.source}
                    icon={<Radio className="h-4 w-4 text-muted-foreground" />}
                  />
                  <DataRow
                    label={t('loading.steps.waypoints', 'Waypoints')}
                    count={dataStatus.waypoints.count}
                    source={dataStatus.waypoints.source}
                    sourceType={dataStatus.sources?.waypoints.source}
                    icon={<Navigation className="h-4 w-4 text-muted-foreground" />}
                  />
                  <DataRow
                    label={t('loading.steps.airways', 'Airways')}
                    count={dataStatus.airways.count}
                    source={dataStatus.airways.source}
                    sourceType={dataStatus.sources?.airways.source}
                    icon={<Route className="h-4 w-4 text-muted-foreground" />}
                  />
                  <DataRow
                    label={t('loading.steps.airspaces', 'Airspaces')}
                    count={dataStatus.airspaces.count}
                    source={dataStatus.airspaces.source}
                    sourceType={dataStatus.sources?.airspaces.source}
                    icon={<Layers className="h-4 w-4 text-muted-foreground" />}
                  />
                  {dataStatus.atc && dataStatus.atc.count > 0 && (
                    <DataRow
                      label={t('settings.xplane.atcFrequencies', 'ATC Frequencies')}
                      count={dataStatus.atc.count}
                      source={dataStatus.atc.source}
                      sourceType="navigraph"
                    />
                  )}
                  {dataStatus.holds && dataStatus.holds.count > 0 && (
                    <DataRow
                      label={t('settings.xplane.holdingPatterns', 'Holdings')}
                      count={dataStatus.holds.count}
                      source={dataStatus.holds.source}
                      sourceType={dataStatus.sources?.holds?.source}
                    />
                  )}
                  {dataStatus.aptMeta && dataStatus.aptMeta.count > 0 && (
                    <DataRow
                      label={t('settings.xplane.airportMetadata', 'Airport Meta')}
                      count={dataStatus.aptMeta.count}
                      source={dataStatus.aptMeta.source}
                      sourceType={dataStatus.sources?.aptMeta?.source}
                    />
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Cache Management */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('settings.navigation.cacheManagement', 'Cache Management')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'settings.navigation.cacheDescription',
              'Clear cached data to force a full reload from X-Plane files'
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleClearCache}
          disabled={isClearing}
          className="gap-2"
        >
          {isClearing ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
          {isClearing
            ? t('settings.navigation.clearingCache', 'Clearing...')
            : t('settings.navigation.clearCache', 'Clear Cache & Reload')}
        </Button>
      </div>
    </div>
  );
}
