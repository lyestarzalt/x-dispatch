import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Database,
  Layers,
  MapPin,
  Navigation,
  Plane,
  Radio,
  Route,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import type { SettingsDataLoadStatus, SettingsSectionProps } from '../types';

type SourceType = 'navigraph' | 'xplane-default' | 'custom-scenery' | 'unknown';

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
        <TooltipProvider>
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
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}

export default function NavigationDataSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const [dataStatus, setDataStatus] = useState<SettingsDataLoadStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDataStatus() {
      try {
        const result = await window.appAPI.getLoadingStatus();
        if (!cancelled) {
          setDataStatus(result.status);
        }
      } catch {
        // Ignore errors
      }
    }

    loadDataStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const globalSource = dataStatus?.sources?.global;
  const isNavigraph = globalSource?.source === 'navigraph';
  const airportBreakdown = dataStatus?.airports?.breakdown;

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

      {/* Airport Layout Data Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plane className="h-4 w-4" />
            {t('settings.navigation.airportLayoutData')}
          </CardTitle>
          <CardDescription>{t('settings.navigation.airportLayoutDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {dataStatus && airportBreakdown && (
            <div className="space-y-3">
              {/* Airport breakdown */}
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
                <div className="rounded-lg border border-violet/30 bg-violet/10 p-3">
                  <div className="flex items-center gap-2 text-xs text-violet">
                    <MapPin className="h-3.5 w-3.5" />
                    {t('settings.navigation.customAirports')}
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-violet">
                    {airportBreakdown.customScenery.toLocaleString()}
                  </div>
                  {airportBreakdown.customSceneryPacks > 0 && (
                    <div className="text-xs text-violet/70">
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
        </CardContent>
      </Card>

      {/* Navigation Data Source Card */}
      <Card className={cn(isNavigraph ? 'border-info/30' : '')}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            {t('settings.navigation.navDataSource')}
          </CardTitle>
          <CardDescription>{t('settings.navigation.navDataSourceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <Badge
                  variant={globalSource.isExpired ? 'destructive' : 'success'}
                  className="gap-1"
                >
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

          {globalSource?.effectiveDate && globalSource?.expirationDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {t('settings.xplane.validDates', 'Valid')}: {formatDate(globalSource.effectiveDate)} -{' '}
              {formatDate(globalSource.expirationDate)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Data Table */}
      {dataStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('settings.xplane.dataLoaded', 'Loaded Data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
