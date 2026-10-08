import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  CircleCheck,
  Download,
  FileText,
  FolderOpen,
  Heart,
  Info,
  Loader2,
  RefreshCw,
  ScrollText,
  TriangleAlert,
} from 'lucide-react';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { AppLogo } from '@/components/ui/AppLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROJECT_WEBSITE } from '@/config/links';
import { cn } from '@/lib/utils/helpers';
import { isNewerVersion } from '@/lib/utils/versionCompare';
import {
  trackEvent,
  useAppVersion,
  useCheckForUpdates,
  useConfigPath,
  useLogPath,
  useUpdateStatus,
} from '@/queries';
import type { UpdateStatus } from '@/types/update';
import { ThirdPartyNoticesDialog } from '../ThirdPartyNoticesDialog';
import { SettingsHeader, SettingsLinkRow, SettingsPathDisplay } from '../primitives';
import type { SettingsSectionProps } from '../types';

const trackDonateClick = () => trackEvent('donate_clicked', { source: 'settings_about' });
const KOFI_URL = 'https://ko-fi.com/A0A21V3IZZ';

interface UpdateStatusLineProps {
  version: string;
  update: UpdateStatus;
  checking: boolean;
  onCheck: () => void;
}

/** One line under the version: what the updater is doing, and the one action that fits. */
function UpdateStatusLine({ version, update, checking, onCheck }: UpdateStatusLineProps) {
  const { t } = useTranslation();
  const outdated = !!update.latestVersion && isNewerVersion(version, update.latestVersion);
  const busy = checking || update.install === 'checking';

  const checkButton = (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
      disabled={busy}
      onClick={onCheck}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
      {t('settings.about.checkForUpdates')}
    </Button>
  );

  if (update.install === 'ready') {
    const readyVersion = update.installVersion ?? update.latestVersion ?? '';
    return (
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <p className="text-success inline-flex items-center gap-1.5 text-xs">
          <CircleCheck className="h-3.5 w-3.5" />
          {t('settings.about.updateReady', { version: readyVersion })}
        </p>
        <DesktopOnly>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => void window.appAPI.installUpdate()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('settings.about.restartToUpdate')}
          </Button>
        </DesktopOnly>
      </div>
    );
  }

  if (busy) {
    return (
      <p className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('settings.about.checkingForUpdates')}
      </p>
    );
  }

  if (update.install === 'downloading') {
    return (
      <p className="text-info mt-2 inline-flex items-center gap-1.5 text-xs">
        <Download className="h-3.5 w-3.5" />
        {t('settings.about.downloadingUpdate')}
      </p>
    );
  }

  if (update.install === 'error') {
    return (
      <div className="mt-2 flex flex-col items-center gap-1">
        <p className="text-warning inline-flex items-center gap-1.5 text-xs">
          <TriangleAlert className="h-3.5 w-3.5" />
          {t('settings.about.updateCheckFailed')}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
          onClick={onCheck}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('settings.about.tryAgain')}
        </Button>
      </div>
    );
  }

  if (outdated && !update.managed) {
    return (
      <button
        type="button"
        onClick={() => window.appAPI.openExternal(update.url)}
        className="border-info/40 bg-info/5 text-info hover:bg-info/10 mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        {t('settings.about.updateAvailable', { version: update.latestVersion })}
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col items-center gap-1">
      {outdated ? (
        <p className="text-info inline-flex items-center gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          {t('settings.about.updateAvailable', { version: update.latestVersion })}
        </p>
      ) : (
        update.latestVersion && (
          <p className="text-success inline-flex items-center gap-1.5 text-xs">
            <CircleCheck className="h-3.5 w-3.5" />
            {t('settings.about.upToDate')}
          </p>
        )
      )}
      {checkButton}
    </div>
  );
}

export default function AboutSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const { data: logPath } = useLogPath();
  const { data: configPath } = useConfigPath();
  const { data: update } = useUpdateStatus();
  const check = useCheckForUpdates();

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Info}
        title={t('settings.about.title')}
        description={t('settings.about.description')}
      />

      {/* App Identity */}
      <div className="flex flex-col items-center pt-2 text-center">
        <AppLogo size="lg" className="mb-4" />
        <h1 className="xp-detail-heading">X-Dispatch</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {version ? `v${version}` : t('common.loading')}
        </p>
        {version && update && (
          <UpdateStatusLine
            version={version}
            update={update}
            checking={check.isPending}
            onCheck={() => check.mutate()}
          />
        )}
        <p className="text-muted-foreground mt-3 max-w-md text-sm">
          {t('settings.about.projectNotice')}
        </p>
        <p className="text-muted-foreground mt-2 max-w-md text-xs">
          {t('settings.about.independenceNotice')}
        </p>
        <p className="text-muted-foreground mt-2 max-w-md text-xs">
          {t('settings.about.simulationOnly')}
        </p>
      </div>

      {/* Credits + Links side-by-side */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.credits')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.developer')}</span>
              <span className="min-w-0 truncate text-right">
                {t('settings.about.developerName')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.license')}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {t('settings.about.licenseValue')}
              </Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.specialThanks')}</span>
              <span className="min-w-0 truncate text-right">
                {t('settings.about.specialThanksName')}{' '}
                <span className="text-muted-foreground">
                  {t('settings.about.specialThanksHandle')}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.links')}</h3>
          <div className="space-y-1">
            <SettingsLinkRow label={t('settings.about.website')} href={PROJECT_WEBSITE} />
            <Button
              variant="ghost"
              onClick={() => setNoticesOpen(true)}
              className="hover:bg-secondary h-auto w-full justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ScrollText className="text-muted-foreground h-3.5 w-3.5" />
                <span className="truncate">{t('settings.about.thirdParty')}</span>
              </span>
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
            </Button>
            <ThirdPartyNoticesDialog open={noticesOpen} onOpenChange={setNoticesOpen} />
            <SettingsLinkRow
              label={t('settings.about.supportProject')}
              href={KOFI_URL}
              leadingIcon={<Heart className="h-3.5 w-3.5 text-red-400" />}
              onOpen={trackDonateClick}
            />
          </div>
        </div>
      </div>

      {/* Data Storage */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.about.dataStorage')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.about.dataStorageDescription')}
        </p>

        {/* Config Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t('settings.about.settingsCache')}
            </span>
            <DesktopOnly>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={() => window.appAPI.openConfigFolder()}
                disabled={!configPath}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t('settings.about.openDataFolder')}
              </Button>
            </DesktopOnly>
          </div>
          {configPath && <SettingsPathDisplay path={configPath} />}
        </div>

        {/* Log Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{t('settings.about.logFile')}</span>
            <div className="flex gap-1">
              <DesktopOnly>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2"
                  onClick={() => window.appAPI.openLogFile()}
                  disabled={!logPath}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('settings.about.openLog')}
                </Button>
              </DesktopOnly>
              <DesktopOnly>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => window.appAPI.openLogFolder()}
                  disabled={!logPath}
                  tooltip={t('settings.about.openLogFolder')}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </DesktopOnly>
            </div>
          </div>
          {logPath && <SettingsPathDisplay path={logPath} />}
        </div>
      </div>
    </div>
  );
}
