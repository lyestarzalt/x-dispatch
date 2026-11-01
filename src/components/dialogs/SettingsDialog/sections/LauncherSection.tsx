import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Rocket, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MAX_REMOTE_PORT, MIN_REMOTE_PORT, parsePort } from '@/lib/remote/port';
import { cn } from '@/lib/utils/helpers';
import { XPLANE_WEB_API_PORT } from '@/lib/xplaneServices/client/port';
import { isValidEnvName } from '@/lib/xplaneServices/launch/launchEnv';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsSectionBlock, SettingsToggleRow } from '../primitives';
import type { SettingsSectionProps } from '../types';
import LaunchArgsSection from './LaunchArgsSection';

export default function LauncherSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const webApiPort = useSettingsStore((s) => s.launcher.webApiPort);
  const closeOnLaunch = useSettingsStore((s) => s.launcher.closeOnLaunch);
  const launchEnv = useSettingsStore((s) => s.launcher.launchEnv);
  const updateLauncherSettings = useSettingsStore((s) => s.updateLauncherSettings);

  // Null while the field shows the saved port; a string while the user edits it.
  const [portDraft, setPortDraft] = useState<string | null>(null);
  const portText = portDraft ?? String(webApiPort);
  const parsedPort = parsePort(portText);
  const portInvalid = portDraft !== null && portDraft !== '' && parsedPort === null;

  const [envName, setEnvName] = useState('');
  const [envValue, setEnvValue] = useState('');
  const envNameTrimmed = envName.trim();
  const envNameInvalid = envNameTrimmed !== '' && !isValidEnvName(envNameTrimmed);
  const addEnv = () => {
    if (!envNameTrimmed || envNameInvalid) return;
    const rest = launchEnv.filter((v) => v.name !== envNameTrimmed);
    updateLauncherSettings({ launchEnv: [...rest, { name: envNameTrimmed, value: envValue }] });
    setEnvName('');
    setEnvValue('');
  };
  const removeEnv = (name: string) =>
    updateLauncherSettings({ launchEnv: launchEnv.filter((v) => v.name !== name) });

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

      <Separator />

      <SettingsSectionBlock
        title={t('settings.launcher.env')}
        description={t('settings.launcher.envDescription')}
      >
        <div className="flex items-center gap-1">
          <Input
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEnv();
              }
            }}
            placeholder={t('settings.launcher.envNamePlaceholder')}
            aria-invalid={envNameInvalid}
            className="h-7 min-w-0 flex-1 font-mono text-xs"
          />
          <span className="text-muted-foreground font-mono text-xs">=</span>
          <Input
            value={envValue}
            onChange={(e) => setEnvValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEnv();
              }
            }}
            placeholder={t('settings.launcher.envValuePlaceholder')}
            className="h-7 min-w-0 flex-1 font-mono text-xs"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={addEnv}
            disabled={!envNameTrimmed || envNameInvalid}
            tooltip={t('common.add')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {envNameInvalid && (
          <p className="text-destructive text-xs">{t('settings.launcher.envInvalidName')}</p>
        )}
        {launchEnv.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {launchEnv.map(({ name, value }) => (
              <Badge key={name} variant="default" className="gap-1 font-mono text-xs">
                {name}={value}
                <button
                  type="button"
                  onClick={() => removeEnv(name)}
                  className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                  aria-label={`${t('common.remove')} ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </SettingsSectionBlock>
    </div>
  );
}
