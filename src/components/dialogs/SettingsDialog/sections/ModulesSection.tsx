import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Link2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { ModuleCatalogEntry } from '@/lib/modules/types';
import { useModulesStore } from '@/stores/modulesStore';
import { SettingsHeader, SettingsSectionBlock } from '../primitives';

export function ModulesSection() {
  const { t } = useTranslation();
  const modules = useModulesStore((s) => s.modules);
  const refresh = useModulesStore((s) => s.refresh);
  const loading = useModulesStore((s) => s.loading);
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!modules.length && !loading) void refresh();
  }, [modules.length, loading, refresh]);

  useEffect(() => {
    void (async () => {
      try {
        setCatalogLoading(true);
        setCatalog(await window.modulesAPI.getCatalog());
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, []);

  const withBusy = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  };

  const installFromZip = async () => {
    const zip = await window.modulesAPI.browseForZip();
    if (!zip) return;
    await withBusy('install-zip', async () => {
      const result = await window.modulesAPI.installFromZip(zip);
      if (!result.success) {
        toast.error(result.error ?? t('common.error'));
        return;
      }
      toast.success(t('modules.installSuccess'));
      await refresh();
    });
  };

  const installFromGithub = async (repoOrUrl: string) => {
    if (!repoOrUrl.trim()) return;
    await withBusy(`install-gh:${repoOrUrl}`, async () => {
      const result = await window.modulesAPI.installFromGithub(repoOrUrl.trim());
      if (!result.success) {
        toast.error(result.error ?? t('common.error'));
        return;
      }
      toast.success(t('modules.installSuccess'));
      setGithubUrl('');
      await refresh();
    });
  };

  const setEnabled = async (moduleId: string, enabled: boolean) => {
    await withBusy(`toggle:${moduleId}`, async () => {
      const result = await window.modulesAPI.setEnabled(moduleId, enabled);
      if (!result.success) toast.error(result.error ?? t('common.error'));
      await refresh();
    });
  };

  const uninstall = async (moduleId: string) => {
    await withBusy(`uninstall:${moduleId}`, async () => {
      const result = await window.modulesAPI.uninstall(moduleId);
      if (!result.success) {
        toast.error(result.error ?? t('common.error'));
        return;
      }
      toast.success(t('modules.uninstallSuccess'));
      await refresh();
    });
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Package}
        title={t('modules.title')}
        description={t('modules.description')}
      />

      <SettingsSectionBlock title={t('modules.installed')}>
        <div className="space-y-2">
          {modules.map((module) => (
            <div
              key={`${module.manifest.id}:${module.manifest.version}:${module.state.source}`}
              className="rounded-md border border-border/40 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{module.manifest.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('modules.installedMeta', {
                      id: module.manifest.id,
                      version: module.manifest.version,
                      source: module.state.source,
                      trustedSuffix: module.state.trusted ? t('modules.trustedSuffix') : '',
                    })}
                  </p>
                </div>
                <Switch
                  checked={module.state.enabled}
                  onCheckedChange={(checked) => void setEnabled(module.manifest.id, checked)}
                  disabled={busyAction === `toggle:${module.manifest.id}`}
                />
                {module.state.source !== 'bundled' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void uninstall(module.manifest.id)}
                    disabled={busyAction === `uninstall:${module.manifest.id}`}
                  >
                    {t('modules.uninstall')}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {modules.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('modules.none')}</p>
          )}
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock title={t('modules.install')}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void installFromZip()}
            disabled={busyAction === 'install-zip'}
          >
            <Download className="h-3.5 w-3.5" />
            {t('modules.installZip')}
          </Button>
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder={t('modules.githubPlaceholder')}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void installFromGithub(githubUrl)}
            disabled={!githubUrl.trim() || busyAction === `install-gh:${githubUrl}`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {t('modules.installGithub')}
          </Button>
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock title={t('modules.store')}>
        <div className="space-y-2">
          {catalogLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
          {!catalogLoading &&
            catalog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.name ?? entry.id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.repository}
                    {entry.trusted ? ` · ${t('modules.trusted')}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void installFromGithub(entry.repository)}
                  disabled={busyAction === `install-gh:${entry.repository}`}
                >
                  {t('modules.install')}
                </Button>
              </div>
            ))}
        </div>
      </SettingsSectionBlock>
    </div>
  );
}
