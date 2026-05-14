import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen, Heart, Info } from 'lucide-react';
import { AppLogo } from '@/components/ui/AppLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { useAppVersion, useConfigPath, useLogPath } from '@/queries';
import { SettingsHeader, SettingsLinkRow, SettingsPathDisplay } from '../primitives';
import type { SettingsSectionProps } from '../types';

const GITHUB_REPO = 'https://github.com/lyestarzalt/x-dispatch';
const PROJECT_WEBSITE = 'https://tarzalt.dev/projects/x-dispatch/';
const KOFI_URL = 'https://ko-fi.com/A0A21V3IZZ';

export default function AboutSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const { data: logPath } = useLogPath();
  const { data: configPath } = useConfigPath();

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
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {version ? `v${version}` : t('common.loading')}
        </p>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          {t('settings.about.projectNotice')}
        </p>
        <p className="mt-2 max-w-md text-xs text-muted-foreground">
          {t('settings.about.independenceNotice')}
        </p>
      </div>

      {/* Credits + Links side-by-side */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.credits')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.developer')}</span>
              <span className="min-w-0 truncate text-right">Lyes Tarzalt</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.license')}</span>
              <Badge variant="outline" className="font-mono text-xs">
                GPL-3.0-only
              </Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.specialThanks')}</span>
              <span className="min-w-0 truncate text-right">
                Gilles <span className="text-muted-foreground">(enjxp / simtwk3)</span>
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.links')}</h3>
          <div className="space-y-1">
            <SettingsLinkRow label={t('settings.about.website')} href={PROJECT_WEBSITE} />
            <SettingsLinkRow label={t('settings.about.sourceCode')} href={GITHUB_REPO} />
            <SettingsLinkRow
              label={t('settings.about.supportProject')}
              href={KOFI_URL}
              leadingIcon={<Heart className="h-3.5 w-3.5 text-red-400" />}
            />
          </div>
        </div>
      </div>

      {/* Data Storage */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.about.dataStorage')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.about.dataStorageDescription')}
        </p>

        {/* Config Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('settings.about.settingsCache')}
            </span>
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
          </div>
          {configPath && <SettingsPathDisplay path={configPath} />}
        </div>

        {/* Log Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('settings.about.logFile')}</span>
            <div className="flex gap-1">
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
            </div>
          </div>
          {logPath && <SettingsPathDisplay path={logPath} />}
        </div>
      </div>
    </div>
  );
}
