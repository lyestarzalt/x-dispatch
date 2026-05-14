import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Boxes, Pencil, Play, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { SUGGESTED_COMPANION_APPS } from '@/lib/companionApps/suggested';
import { cn } from '@/lib/utils/helpers';
import { useElevationQuery } from '@/queries/useElevationQuery';
import { type CompanionApp, useCompanionAppsStore } from '@/stores/companionAppsStore';
import { SettingsEmptyState, SettingsHeader } from '../primitives';
import type { SettingsSectionProps } from '../types';
import { CompanionAppEditDialog } from './CompanionAppEditDialog';

type SpawnErrorCode = 'NEEDS_ADMIN' | 'FILE_MISSING' | 'FILE_NOT_EXECUTABLE' | 'SPAWN_FAILED';

/** Map a spawn error code to a localized i18n key under settings.companionApps.error.* */
function errorKeyFor(code: SpawnErrorCode | undefined): string {
  switch (code) {
    case 'NEEDS_ADMIN':
      return 'settings.companionApps.error.needsAdmin';
    case 'FILE_MISSING':
      return 'settings.companionApps.error.fileMissing';
    case 'FILE_NOT_EXECUTABLE':
      return 'settings.companionApps.error.fileNotExecutable';
    default:
      return 'settings.companionApps.error.spawnFailed';
  }
}

type EditState =
  | { open: false }
  | { open: true; mode: 'add'; initial: Partial<Omit<CompanionApp, 'id'>>; targetId?: undefined }
  | { open: true; mode: 'edit'; initial: Partial<Omit<CompanionApp, 'id'>>; targetId: string };

export function CompanionAppsSection({ className }: SettingsSectionProps = {}) {
  const { t } = useTranslation();
  const tools = useCompanionAppsStore((s) => s.tools);
  const addTool = useCompanionAppsStore((s) => s.addTool);
  const updateTool = useCompanionAppsStore((s) => s.updateTool);
  const removeTool = useCompanionAppsStore((s) => s.removeTool);
  const elevation = useElevationQuery();

  const [edit, setEdit] = useState<EditState>({ open: false });

  const openAdd = () => setEdit({ open: true, mode: 'add', initial: {} });
  const openAddFromSuggestion = (id: string) => {
    const s = SUGGESTED_COMPANION_APPS.find((x) => x.id === id);
    if (!s) return;
    const platform =
      typeof process !== 'undefined' && process.platform
        ? (process.platform as 'win32' | 'darwin' | 'linux')
        : 'darwin';
    setEdit({
      open: true,
      mode: 'add',
      initial: {
        name: s.name,
        exePath: s.pathHints[platform] ?? '',
        args: s.args,
        delayBeforeXPlaneSec: s.delayBeforeXPlaneSec,
        autoLaunch: false,
      },
    });
  };
  const openEdit = (tool: CompanionApp) =>
    setEdit({ open: true, mode: 'edit', initial: tool, targetId: tool.id });
  const closeEdit = () => setEdit({ open: false });

  const handleSave = (input: Omit<CompanionApp, 'id'>) => {
    if (edit.open && edit.mode === 'edit') {
      updateTool(edit.targetId, input);
    } else {
      addTool(input);
    }
  };

  const launchNow = async (tool: CompanionApp) => {
    const result = await window.companionAppsAPI.launch({
      exePath: tool.exePath,
      args: tool.args,
      cwd: tool.cwd,
    });
    if (!result.success) {
      const code = result.code as SpawnErrorCode | undefined;
      toast.error(
        t('settings.companionApps.spawnError', {
          name: tool.name,
          error: t(errorKeyFor(code), {
            defaultValue: result.error ?? t('settings.companionApps.unknownError'),
          }),
        })
      );
    }
  };

  // Banner is Windows-only: on macOS/Linux normal user apps don't need root
  // to launch peer apps, so the warning would just confuse non-Windows users.
  const showAdminBanner = elevation.data === false && window.appAPI.platform === 'win32';

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Boxes}
        title={t('settings.companionApps.title')}
        description={t('settings.companionApps.description')}
      />

      {/* Admin banner — flat inline alert */}
      {showAdminBanner && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">
              {t('settings.companionApps.notElevatedTitle')}
            </p>
            <p className="text-muted-foreground">{t('settings.companionApps.notElevatedHint')}</p>
          </div>
        </div>
      )}

      {/* Configured tools */}
      {tools.length === 0 ? (
        <SettingsEmptyState message={t('settings.companionApps.empty')} />
      ) : (
        <ul className="space-y-2">
          {tools.map((tool) => (
            <li key={tool.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground">{tool.name}</span>
                  <p
                    className="mt-0.5 truncate font-mono text-xs text-muted-foreground"
                    title={tool.exePath}
                  >
                    {tool.exePath}
                  </p>
                  {(tool.args || tool.delayBeforeXPlaneSec > 0) && (
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {tool.args && <span className="font-mono">{tool.args}</span>}
                      {tool.args && tool.delayBeforeXPlaneSec > 0 && ' · '}
                      {tool.delayBeforeXPlaneSec > 0 && (
                        <span>
                          {t('settings.companionApps.delayInline', {
                            seconds: tool.delayBeforeXPlaneSec,
                          })}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={tool.autoLaunch}
                    onCheckedChange={(v) => updateTool(tool.id, { autoLaunch: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => launchNow(tool)}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(tool)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeTool(tool.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        {t('settings.companionApps.addButton')}
      </Button>

      <Separator />

      {/* Suggested */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.companionApps.suggested')}</h3>
        <ul className="space-y-2">
          {SUGGESTED_COMPANION_APPS.map((s) => {
            const alreadyAdded = tools.some(
              (tool) => tool.name.toLowerCase() === s.name.toLowerCase()
            );
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground/70">{s.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={alreadyAdded}
                  onClick={() => openAddFromSuggestion(s.id)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t('settings.companionApps.add')}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      {edit.open && (
        <CompanionAppEditDialog
          open
          initial={edit.initial}
          title={
            edit.mode === 'edit'
              ? t('settings.companionApps.edit')
              : t('settings.companionApps.addButton')
          }
          onClose={closeEdit}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
