import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Database,
  Layers,
  MapPin,
  Navigation,
  Plane,
  Radio,
  RefreshCw,
  Route,
} from 'lucide-react';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import navigraphLogo from '../../../../../assets/navigraph-small.png';
import xpnavdataLogo from '../../../../../assets/xpnavdata-icon.png';
import { SettingsHeader, SettingsSectionBlock } from '../primitives';
import type { SettingsSectionProps } from '../types';

type SourceType = 'navigraph' | 'custom' | 'xplane-default' | 'custom-scenery' | 'unknown';

const PROVIDER_LOGOS: Record<string, string> = {
  Navigraph: navigraphLogo,
  XPNavData: xpnavdataLogo,
};
type SettingsDataLoadStatus = NonNullable<
  Awaited<ReturnType<typeof window.appAPI.getLoadingStatus>>['status']
>;

const NAVIGRAPH_SOURCE: SourceType = 'navigraph';

interface DataRowProps {
  label: string;
  count: number;
  source: string | null;
  sourceType?: SourceType;
  /** Provider name from the nav data header; wins over the generic label */
  provider?: string | null;
  icon?: React.ReactNode;
}

function getSourceLabelKey(sourceType: SourceType | undefined, source: string | null): string {
  if (sourceType === 'navigraph') return 'settings.navigation.navigraphLabel';
  if (sourceType === 'custom') return 'settings.navigation.customDataLabel';
  if (sourceType === 'xplane-default') return 'settings.navigation.xplaneDefaultLabel';
  if (sourceType === 'custom-scenery') return 'settings.navigation.customAirportLabel';
  // Fallback: detect from path. Custom Data without a known provider gets the
  // generic label — the provider name comes from the nav data header.
  if (source?.includes('Custom Data')) return 'settings.navigation.customDataLabel';
  if (source?.includes('Custom Scenery')) return 'settings.navigation.customAirportLabel';
  if (source?.includes('default data')) return 'settings.navigation.xplaneDefaultLabel';
  return 'settings.navigation.defaultLabel';
}

function DataRow({ label, count, source, sourceType, provider, icon }: DataRowProps) {
  const { t } = useTranslation();
  const displaySource = provider ?? t(getSourceLabelKey(sourceType, source));

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
            <Badge variant="secondary" className="cursor-help font-normal">
              {displaySource}
            </Badge>
          </TooltipTrigger>
          {source && (
            <TooltipContent side="left" className="max-w-xs">
              <p className="font-mono text-xs break-all">{source}</p>
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
      <SettingsHeader
        icon={Database}
        title={t('settings.navigation.dataTitle')}
        description={t('settings.navigation.dataDescription')}
      />

      {/* Airport Layout Data */}
      <SettingsSectionBlock
        title={t('settings.navigation.airportLayoutData')}
        description={t('settings.navigation.airportLayoutDescription')}
        icon={Plane}
      >
        {dataStatus && airportBreakdown && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Building2 className="h-3.5 w-3.5" />
                  {t('settings.navigation.globalAirports')}
                </div>
                <div className="mt-1 font-mono text-lg font-semibold">
                  {airportBreakdown.globalAirports.toLocaleString()}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('settings.navigation.customAirports')}
                </div>
                <div className="mt-1 font-mono text-lg font-semibold">
                  {airportBreakdown.customScenery.toLocaleString()}
                </div>
                {airportBreakdown.customSceneryPacks > 0 && (
                  <div className="text-muted-foreground text-xs">
                    {t('settings.navigation.fromSceneryPacks', {
                      count: airportBreakdown.customSceneryPacks,
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {t('settings.navigation.totalAirports')}
              </span>
              <span className="font-mono font-medium">
                {dataStatus.airports.count.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </SettingsSectionBlock>

      {/* Navigation Data Source */}
      <SettingsSectionBlock
        title={t('settings.navigation.navDataSource')}
        description={t('settings.navigation.navDataSourceDescription')}
        icon={Radio}
      >
        {globalSource && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1.5">
              {globalSource.provider && PROVIDER_LOGOS[globalSource.provider] && (
                <img
                  src={PROVIDER_LOGOS[globalSource.provider]}
                  alt=""
                  className="h-3.5 w-3.5 rounded-[3px] object-contain"
                />
              )}
              {globalSource.provider ?? t(getSourceLabelKey(globalSource.source, null))}
            </Badge>
            {globalSource.cycle && (
              <span className="text-muted-foreground font-mono text-sm">
                AIRAC {globalSource.cycle}
                {globalSource.revision && `.${globalSource.revision}`}
              </span>
            )}
            {globalSource.isExpired && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-warning/50 text-warning cursor-help font-normal"
                  >
                    {t('settings.navigation.airacExpired')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">
                    {t('settings.navigation.airacExpiredTooltip', {
                      date: globalSource.expirationDate
                        ? new Date(globalSource.expirationDate).toLocaleDateString()
                        : '',
                    })}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </SettingsSectionBlock>

      {/* Navigation Data Table */}
      {dataStatus && (
        <SettingsSectionBlock title={t('settings.xplane.dataLoaded')}>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.xplane.dataType')}</TableHead>
                  <TableHead className="text-right">{t('settings.xplane.count')}</TableHead>
                  <TableHead>{t('settings.xplane.source')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DataRow
                  label={t('loading.steps.navaids')}
                  count={dataStatus.navaids.count}
                  source={dataStatus.navaids.source}
                  sourceType={dataStatus.sources?.navaids.source}
                  provider={dataStatus.sources?.navaids.provider}
                  icon={<Radio className="text-muted-foreground h-4 w-4" />}
                />
                <DataRow
                  label={t('loading.steps.waypoints')}
                  count={dataStatus.waypoints.count}
                  source={dataStatus.waypoints.source}
                  sourceType={dataStatus.sources?.waypoints.source}
                  provider={dataStatus.sources?.waypoints.provider}
                  icon={<Navigation className="text-muted-foreground h-4 w-4" />}
                />
                <DataRow
                  label={t('loading.steps.airways')}
                  count={dataStatus.airways.count}
                  source={dataStatus.airways.source}
                  sourceType={dataStatus.sources?.airways.source}
                  provider={dataStatus.sources?.airways.provider}
                  icon={<Route className="text-muted-foreground h-4 w-4" />}
                />
                <DataRow
                  label={t('loading.steps.airspaces')}
                  count={dataStatus.airspaces.count}
                  source={dataStatus.airspaces.source}
                  sourceType={dataStatus.sources?.airspaces.source}
                  provider={dataStatus.sources?.airspaces.provider}
                  icon={<Layers className="text-muted-foreground h-4 w-4" />}
                />
                {dataStatus.atc && dataStatus.atc.count > 0 && (
                  <DataRow
                    label={t('settings.xplane.atcFrequencies')}
                    count={dataStatus.atc.count}
                    source={dataStatus.atc.source}
                    sourceType={NAVIGRAPH_SOURCE}
                    provider={dataStatus.sources?.atc?.provider}
                  />
                )}
                {dataStatus.holds && dataStatus.holds.count > 0 && (
                  <DataRow
                    label={t('settings.xplane.holdingPatterns')}
                    count={dataStatus.holds.count}
                    source={dataStatus.holds.source}
                    sourceType={dataStatus.sources?.holds?.source}
                    provider={dataStatus.sources?.holds?.provider}
                  />
                )}
                {dataStatus.aptMeta && dataStatus.aptMeta.count > 0 && (
                  <DataRow
                    label={t('settings.xplane.airportMetadata')}
                    count={dataStatus.aptMeta.count}
                    source={dataStatus.aptMeta.source}
                    sourceType={dataStatus.sources?.aptMeta?.source}
                    provider={dataStatus.sources?.aptMeta?.provider}
                  />
                )}
              </TableBody>
            </Table>
          </div>
        </SettingsSectionBlock>
      )}

      {/* Cache Management */}
      <SettingsSectionBlock
        title={t('settings.navigation.cacheManagement')}
        description={t('settings.navigation.cacheDescription')}
        icon={RefreshCw}
      >
        <DesktopOnly>
          <Button
            variant="outline"
            onClick={handleClearCache}
            disabled={isClearing}
            className="gap-2"
          >
            {isClearing ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            {isClearing
              ? t('settings.navigation.clearingCache')
              : t('settings.navigation.clearCache')}
          </Button>
        </DesktopOnly>
      </SettingsSectionBlock>
    </div>
  );
}
