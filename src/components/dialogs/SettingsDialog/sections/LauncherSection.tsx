import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MAX_REMOTE_PORT, MIN_REMOTE_PORT, parsePort } from '@/lib/remote/port';
import { cn } from '@/lib/utils/helpers';
import { XPLANE_WEB_API_PORT } from '@/lib/xplaneServices/client/port';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsSectionBlock, SettingsToggleRow } from '../primitives';
import type { SettingsSectionProps } from '../types';
import LaunchArgsSection from './LaunchArgsSection';

export default function LauncherSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const webApiPort = useSettingsStore((s) => s.launcher.webApiPort);
  const closeOnLaunch = useSettingsStore((s) => s.launcher.closeOnLaunch);
  const updateLauncherSettings = useSettingsStore((s) => s.updateLauncherSettings);

  // Null while the field shows the saved port; a string while the user edits it.
  const [portDraft, setPortDraft] = useState<string | null>(null);
  const portText = portDraft ?? String(webApiPort);
  const parsedPort = parsePort(portText);
  const portInvalid = portDraft !== null && portDraft !== '' && parsedPort === null;

  const applyPort = () => {
    setPortDraft(null);
    if (parsedPort !== null && parsedPort !== webApiPort) {
      updateLauncherSettings({ webApiPort: parsedPort });
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Rocket}
        title={t('settings.launcher.title')}
        description={t('settings.launcher.description')}
      />

      <SettingsSectionBlock title={t('settings.launcher.connection')}>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="min-w-0">
            <Label htmlFor="xplane-web-api-port" className="text-sm font-medium">
              {t('settings.launcher.webApiPort')}
            </Label>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('settings.launcher.webApiPortDesc', { default: XPLANE_WEB_API_PORT })}
            </p>
            {portInvalid && (
              <p className="text-destructive mt-1 text-xs">
                {t('settings.launcher.webApiPortInvalid', {
                  min: MIN_REMOTE_PORT,
                  max: MAX_REMOTE_PORT,
                })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {webApiPort !== XPLANE_WEB_API_PORT && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setPortDraft(null);
                  updateLauncherSettings({ webApiPort: XPLANE_WEB_API_PORT });
                }}
              >
                {t('settings.launcher.webApiPortReset', { port: XPLANE_WEB_API_PORT })}
              </Button>
            )}
            <Input
              id="xplane-web-api-port"
              inputMode="numeric"
              value={portText}
              aria-invalid={portInvalid}
              onChange={(e) => setPortDraft(e.target.value)}
              onBlur={applyPort}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="w-28 font-mono text-sm"
            />
          </div>
        </div>
        {webApiPort !== XPLANE_WEB_API_PORT && (
          <div className="border-warning/40 bg-warning/5 rounded-lg border p-3">
            <p className="text-muted-foreground text-sm">
              {t('settings.launcher.webApiPortRestart', { port: webApiPort })}
            </p>
          </div>
        )}
      </SettingsSectionBlock>

      <Separator />

      <SettingsSectionBlock title={t('settings.launcher.behavior')}>
        <SettingsToggleRow
          title={t('settings.xplane.closeOnLaunch')}
          description={t('settings.xplane.closeOnLaunchDescription')}
          checked={closeOnLaunch}
          onCheckedChange={(checked) => updateLauncherSettings({ closeOnLaunch: checked })}
        />
      </SettingsSectionBlock>

      <Separator />

      <LaunchArgsSection />
    </div>
  );
}
