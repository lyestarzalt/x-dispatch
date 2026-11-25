import { useTranslation } from 'react-i18next';
import { RefreshCw, Tags } from 'lucide-react';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsRemoteClient } from '@/hooks/useIsRemoteClient';
import { formatDate } from '@/lib/utils/format';
import { useDownloadFaaCharts, useFaaChartStatus, useSetFaaChartDownload } from '@/queries';
import { SettingsSectionBlock, SettingsToggleRow } from '../primitives';
import type { SettingsSectionProps } from '../types';

/**
 * US procedure labels (OBSTACLE, RNAV, ILS OR LOC) from the FAA's procedure index: the
 * download switch, then one line in the shape of the nav data source above it: source badge,
 * cycle, expiry, refresh.
 */
export default function FaaChartLabelsSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { data: status } = useFaaChartStatus();
  const setDownload = useSetFaaChartDownload();
  const downloadNow = useDownloadFaaCharts();
  const remote = useIsRemoteClient();

  const downloading = !!status?.downloading || downloadNow.isPending;
  const showLine = !!status && status.enabled;

  return (
    <SettingsSectionBlock
      className={className}
      title={t('settings.navigation.faaCharts.title')}
      description={t('settings.navigation.faaCharts.description')}
      icon={Tags}
    >
      {/* Shown once the stored choice is known, never a guessed state. */}
      {status && (
        <DesktopOnly>
          <SettingsToggleRow
            title={t('settings.navigation.faaCharts.toggle')}
            description={t('settings.navigation.faaCharts.toggleDescription')}
            checked={status.enabled}
            disabled={setDownload.isPending}
            onCheckedChange={(enabled) => setDownload.mutate(enabled)}
          />
        </DesktopOnly>
      )}

      {showLine && (
        <div className="flex min-w-0 items-center gap-2">
          {status.source !== 'none' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="shrink-0 cursor-help">
                  {t('settings.navigation.faaCharts.faaLabel')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  {t('settings.navigation.faaCharts.downloadedTooltip', {
                    date: formatDate(status.fetchedAt),
                  })}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          {status.cycle && (
            <span className="text-muted-foreground shrink-0 font-mono text-sm">
              AIRAC {status.cycle}
            </span>
          )}
          {status.expired && !downloading && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="border-warning/50 text-warning shrink-0 cursor-help font-normal"
                >
                  {t('settings.navigation.airacExpired')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  {t('settings.navigation.airacExpiredTooltip', {
                    date: formatDate(status.validUntil),
                  })}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          <span
            className={
              status.error && !downloading
                ? 'text-warning min-w-0 truncate text-sm'
                : 'text-muted-foreground min-w-0 truncate text-sm'
            }
          >
            {downloading
              ? t('settings.navigation.faaCharts.downloading')
              : status.error
                ? t(
                    status.error === 'network'
                      ? 'settings.navigation.faaCharts.errorNetwork'
                      : 'settings.navigation.faaCharts.errorInvalid'
                  )
                : status.source === 'none'
                  ? t('settings.navigation.faaCharts.notYet')
                  : null}
          </span>
          {status.enabled && !remote && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 shrink-0"
                  aria-label={t('settings.navigation.faaCharts.downloadNow')}
                  disabled={downloading}
                  onClick={() => downloadNow.mutate(undefined)}
                >
                  {downloading ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t('settings.navigation.faaCharts.downloadNow')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </SettingsSectionBlock>
  );
}
