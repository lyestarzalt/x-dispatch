import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CompanionApp } from '@/stores/companionAppsStore';

export interface CompanionAppEditDialogProps {
  open: boolean;
  initial: Partial<Omit<CompanionApp, 'id'>>;
  title: string;
  onClose: () => void;
  onSave: (input: Omit<CompanionApp, 'id'>) => void;
}

export function CompanionAppEditDialog({
  open,
  initial,
  title,
  onClose,
  onSave,
}: CompanionAppEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name ?? '');
  const [exePath, setExePath] = useState(initial.exePath ?? '');
  const [args, setArgs] = useState(initial.args ?? '');
  const [cwd, setCwd] = useState(initial.cwd ?? '');
  const [autoLaunch, setAutoLaunch] = useState(initial.autoLaunch ?? false);
  const [delaySec, setDelaySec] = useState(initial.delayBeforeXPlaneSec ?? 0);

  useEffect(() => {
    if (!open) return;
    // Reset form fields when the dialog reopens with potentially-new initial
    // values. `initial` intentionally excluded; we re-seed only on open.
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(initial.name ?? '');
    setExePath(initial.exePath ?? '');
    setArgs(initial.args ?? '');
    setCwd(initial.cwd ?? '');
    setAutoLaunch(initial.autoLaunch ?? false);
    setDelaySec(initial.delayBeforeXPlaneSec ?? 0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const browseExe = async () => {
    const picked = await window.companionAppsAPI.browseForExe();
    if (picked) setExePath(picked);
  };

  const handleSave = () => {
    if (!name.trim() || !exePath.trim()) return;
    onSave({
      name: name.trim(),
      exePath: exePath.trim(),
      args: args.trim() || undefined,
      cwd: cwd.trim() || undefined,
      autoLaunch,
      delayBeforeXPlaneSec: Math.max(0, Math.floor(delaySec)),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('settings.companionApps.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ca-name" className="xp-label">
              {t('settings.companionApps.fields.name')}
            </Label>
            <Input id="ca-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-exe" className="xp-label">
              {t('settings.companionApps.fields.exePath')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="ca-exe"
                value={exePath}
                onChange={(e) => setExePath(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button type="button" variant="outline" size="icon" onClick={browseExe}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-args" className="xp-label">
              {t('settings.companionApps.fields.args')}
            </Label>
            <Input
              id="ca-args"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-cwd" className="xp-label">
              {t('settings.companionApps.fields.cwd')}
            </Label>
            <Input
              id="ca-cwd"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ca-auto" className="xp-label">
              {t('settings.companionApps.autoLaunch')}
            </Label>
            <Switch id="ca-auto" checked={autoLaunch} onCheckedChange={setAutoLaunch} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-delay" className="xp-label">
              {t('settings.companionApps.delayLabel')}
            </Label>
            <Input
              id="ca-delay"
              type="number"
              min={0}
              value={delaySec}
              onChange={(e) => setDelaySec(Number(e.target.value))}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('settings.companionApps.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !exePath.trim()}>
            {t('settings.companionApps.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
