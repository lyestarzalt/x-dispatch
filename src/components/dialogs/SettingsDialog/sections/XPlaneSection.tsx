import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, FolderOpen, Pencil, Plane, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/helpers';
import { appKeys, useActiveInstallation, useInstallations } from '@/queries';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SettingsSectionProps } from '../types';
import LaunchArgsCard from './LaunchArgsCard';

export default function XPlaneSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: installations = [] } = useInstallations();
  const { data: activeInstallation } = useActiveInstallation();
  const closeOnLaunch = useSettingsStore((s) => s.launcher.closeOnLaunch);
  const updateLauncherSettings = useSettingsStore((s) => s.updateLauncherSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [versionInfo, setVersionInfo] = useState<{
    raw: string;
    isSteam: boolean;
  } | null>(null);

  // Add installation flow: browse → name input → confirm
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const newNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.appAPI.getXPlaneVersion().then((info) => {
      if (info) setVersionInfo({ raw: info.raw, isSteam: info.isSteam });
    });
  }, [activeInstallation?.id]);

  useEffect(() => {
    if (pendingPath && newNameRef.current) {
      newNameRef.current.focus();
    }
  }, [pendingPath]);

  const invalidateInstallations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: appKeys.installations });
    queryClient.invalidateQueries({ queryKey: appKeys.activeInstallation });
  }, [queryClient]);

  const handleBrowse = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.xplaneAPI.browseForPath();
      if (result?.valid) {
        setPendingPath(result.path);
        setNewName('');
      } else if (result && !result.valid) {
        setError(result.errors.join(', '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAdd = async (andSwitch: boolean) => {
    if (!pendingPath) return;
    setLoading(true);
    setError(null);
    try {
      const addResult = await window.xplaneAPI.addInstallation(
        newName.trim() || 'Main',
        pendingPath
      );
      if (!addResult.success) {
        setError(addResult.errors?.[0] || 'Failed to add installation');
        setLoading(false);
        return;
      }
      setPendingPath(null);
      setNewName('');

      if (andSwitch && addResult.installation) {
        await window.xplaneAPI.switchInstallation(addResult.installation.id);
        // Window will reload
      } else {
        invalidateInstallations();
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setPendingPath(null);
    setNewName('');
  };

  const handleSwitch = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await window.xplaneAPI.switchInstallation(id);
      // Window will reload
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    const result = await window.xplaneAPI.removeInstallation(id);
    if (result) {
      invalidateInstallations();
    }
  };

  const handleRenameSubmit = async (id: string) => {
    if (editName.trim()) {
      await window.xplaneAPI.renameInstallation(id, editName.trim());
      invalidateInstallations();
    }
    setEditingId(null);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Plane className="h-5 w-5" />
          {t('settings.xplane.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.xplane.description')}</p>
      </div>

      <Separator />

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Installation List */}
      <div className="space-y-3">
        {installations.map((install) => {
          const isActive = install.id === activeInstallation?.id;
          const isEditing = editingId === install.id;

          return (
            <div
              key={install.id}
              className={cn(
                'rounded-lg border p-4',
                isActive ? 'border-success/50 bg-success/10' : 'border-border bg-muted/30'
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                {isActive && <Check className="h-4 w-4 shrink-0 text-success" />}
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameSubmit(install.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(install.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 w-40 text-sm"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium">{install.name}</span>
                )}
                {isActive && versionInfo && (
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {versionInfo.raw}
                    </Badge>
                    {versionInfo.isSteam && (
                      <Badge variant="outline" className="text-xs">
                        {t('settings.xplane.steam')}
                      </Badge>
                    )}
                  </>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(install.id);
                        setEditName(install.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!isActive && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleSwitch(install.id)}
                        disabled={loading}
                      >
                        {t('settings.xplane.switch')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(install.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="truncate font-mono text-sm text-muted-foreground">{install.path}</p>
            </div>
          );
        })}
      </div>

      {/* Pending add: name input + confirm */}
      {pendingPath ? (
        <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-4">
          <p className="truncate font-mono text-sm text-muted-foreground">{pendingPath}</p>
          <div className="space-y-1.5">
            <Label htmlFor="install-name" className="text-sm">
              {t('settings.xplane.name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="install-name"
              ref={newNameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) handleConfirmAdd(false);
                if (e.key === 'Escape') handleCancelAdd();
              }}
              placeholder={t('settings.xplane.namePlaceholder')}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => handleConfirmAdd(true)}
              disabled={loading || !newName.trim()}
            >
              {loading ? <Spinner /> : null}
              {t('settings.xplane.addAndSwitch')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConfirmAdd(false)}
              disabled={loading || !newName.trim()}
            >
              {t('settings.xplane.add')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancelAdd} disabled={loading}>
              {t('settings.xplane.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={handleBrowse} disabled={loading} className="gap-2">
          {loading ? <Spinner /> : <FolderOpen className="h-4 w-4" />}
          {t('settings.xplane.addInstallation')}
        </Button>
      )}

      <Separator />

      {/* Launch Behavior */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{t('settings.xplane.closeOnLaunch')}</p>
          <p className="text-xs text-muted-foreground">
            {t('settings.xplane.closeOnLaunchDescription')}
          </p>
        </div>
        <Switch
          checked={closeOnLaunch}
          onCheckedChange={(checked) => updateLauncherSettings({ closeOnLaunch: checked })}
        />
      </div>

      <Separator />

      {/* Launch Arguments */}
      <LaunchArgsCard />
    </div>
  );
}
