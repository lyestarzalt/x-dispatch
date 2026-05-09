import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOutput, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFmsFormatLabel } from '@/lib/simbrief/fmsFormats';
import { type FmsExportTarget, useSettingsStore } from '@/stores/settingsStore';
import { EditFmsTargetDialog } from './EditFmsTargetDialog';

export function FmsExportTargetsCard() {
  const { t } = useTranslation();
  const targets = useSettingsStore((s) => s.simbrief.fmsExportTargets);
  const addFmsExportTarget = useSettingsStore((s) => s.addFmsExportTarget);
  const updateFmsExportTarget = useSettingsStore((s) => s.updateFmsExportTarget);
  const removeFmsExportTarget = useSettingsStore((s) => s.removeFmsExportTarget);

  const [editing, setEditing] = useState<FmsExportTarget | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FmsExportTarget | undefined>(undefined);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FolderOutput className="h-4 w-4 text-muted-foreground" />
            {t('settings.simbrief.fmsExportTargets.heading', 'FMS export targets')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.simbrief.fmsExportTargets.description',
              "Drop the SimBrief flight plan into your aircraft's flight-plan folder."
            )}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('settings.simbrief.fmsExportTargets.add', 'Add target')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              'settings.simbrief.fmsExportTargets.empty',
              'No targets yet. Add one to send SimBrief plans straight into an addon folder.'
            )}
          </p>
        ) : (
          <ul className="space-y-1">
            {targets.map((target) => (
              <li
                key={target.id}
                className="flex items-center gap-2 rounded-md border border-border bg-popover/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{target.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {getFmsFormatLabel(target.formatKey)}
                    </span>
                  </div>
                  <div
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={target.folderPath}
                  >
                    {target.folderPath}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(target)}
                  tooltip={t('common.edit', 'Edit')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(target)}
                  tooltip={t('common.delete', 'Delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <EditFmsTargetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(values) => addFmsExportTarget(values)}
      />

      <EditFmsTargetDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        initial={editing}
        onSave={(values) => editing && updateFmsExportTarget(editing.id, values)}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.simbrief.fmsExportTargets.deleteTitle', 'Delete this export target?')}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) removeFmsExportTarget(confirmDelete.id);
                setConfirmDelete(undefined);
              }}
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
