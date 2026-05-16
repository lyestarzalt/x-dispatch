import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FMS_FORMATS, getFmsFormatLabel } from '@/lib/simbrief/fmsFormats';
import type { FmsExportTarget } from '@/stores/settingsStore';

interface EditFmsTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this target. When omitted, the dialog adds a new target. */
  initial?: FmsExportTarget;
  onSave: (values: Omit<FmsExportTarget, 'id'>) => void;
}

export function EditFmsTargetDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: EditFmsTargetDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [formatKey, setFormatKey] = useState(initial?.formatKey ?? FMS_FORMATS[0]!.key);
  const [label, setLabel] = useState(initial?.label ?? FMS_FORMATS[0]!.label);
  const [labelEdited, setLabelEdited] = useState(false);
  const [folderPath, setFolderPath] = useState(initial?.folderPath ?? '');

  useEffect(() => {
    if (open) {
      // Reset form fields when the dialog reopens with potentially-new initial
      // values.
      /* eslint-disable react-hooks/set-state-in-effect */
      setFormatKey(initial?.formatKey ?? FMS_FORMATS[0]!.key);
      setLabel(initial?.label ?? FMS_FORMATS[0]!.label);
      setLabelEdited(!!initial);
      setFolderPath(initial?.folderPath ?? '');
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, initial]);

  const handleFormatChange = (next: string) => {
    setFormatKey(next);
    if (!labelEdited) {
      setLabel(getFmsFormatLabel(next));
    }
  };

  const handlePickFolder = async () => {
    const picked = await window.appAPI.pickDirectory({
      title: t('settings.simbrief.fmsExportTargets.pickFolderTitle', 'Pick export folder'),
      defaultPath: folderPath || undefined,
    });
    if (picked) setFolderPath(picked);
  };

  const canSave = !!formatKey && !!folderPath && !!label.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({ formatKey, label: label.trim(), folderPath });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('settings.simbrief.fmsExportTargets.editTitle', 'Edit export target')
              : t('settings.simbrief.fmsExportTargets.addTitle', 'Add export target')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'settings.simbrief.fmsExportTargets.dialogDescription',
              'Pick the SimBrief format your aircraft addon expects, and the folder it reads from.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fms-target-format">
              {t('settings.simbrief.fmsExportTargets.format', 'Format')}
            </Label>
            <Select value={formatKey} onValueChange={handleFormatChange}>
              <SelectTrigger id="fms-target-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FMS_FORMATS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fms-target-label">
              {t('settings.simbrief.fmsExportTargets.label', 'Label')}
            </Label>
            <Input
              id="fms-target-label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelEdited(true);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fms-target-folder">
              {t('settings.simbrief.fmsExportTargets.folder', 'Target folder')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="fms-target-folder"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder={t('settings.simbrief.fmsExportTargets.folderPlaceholder')}
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" onClick={handlePickFolder}>
                <Folder className="mr-2 h-4 w-4" />
                {t('common.browse', 'Browse')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
