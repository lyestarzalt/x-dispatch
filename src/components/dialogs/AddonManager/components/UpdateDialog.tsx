// src/components/dialogs/AddonManager/components/UpdateDialog.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import type { UpdateTargetType } from '@/lib/addonManager/updates/UpdateManager';
import { useAddonUpdateApply, useAddonUpdateCheck } from '@/queries/useAddonManager';

export interface UpdateTarget {
  type: UpdateTargetType;
  folderName: string;
  displayName: string;
}

interface UpdateDialogProps {
  target: UpdateTarget | null;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Mounted per addon, so switching targets starts from a clean slate.
 */
function UpdateDialogBody({ target, onClose }: { target: UpdateTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const checkMutation = useAddonUpdateCheck();
  const applyMutation = useAddonUpdateApply();

  const [progressPercent, setProgressPercent] = useState(0);
  const [currentFile, setCurrentFile] = useState('');

  const { mutate: check } = checkMutation;
  const { type, folderName } = target;

  useEffect(() => {
    check({ type, folderName });
  }, [check, type, folderName]);

  useEffect(() => {
    return window.addonManagerAPI.updates.onProgress((progress) => {
      setCurrentFile(progress.currentFile);
      setProgressPercent(
        progress.bytesTotal > 0
          ? Math.round((progress.bytesDownloaded / progress.bytesTotal) * 100)
          : 0
      );
    });
  }, []);

  const status = checkMutation.data;
  const result = applyMutation.data;
  const error = checkMutation.error ?? applyMutation.error;

  const handleCancel = async () => {
    await window.addonManagerAPI.updates.cancel();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('addonManager.updates.title', { name: target.displayName })}</DialogTitle>
        <DialogDescription>{t('addonManager.updates.description')}</DialogDescription>
      </DialogHeader>

      {checkMutation.isPending && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Spinner className="size-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            {t('addonManager.updates.checking')}
          </span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('addonManager.updates.failed')}
          </AlertDescription>
        </Alert>
      )}

      {status && !result && !applyMutation.isPending && (
        <div className="flex flex-col gap-3 py-2">
          <div className="rounded-lg border border-border bg-card/50 p-3 text-sm">
            <p>
              {t('addonManager.updates.versions', {
                local: status.localVersion || '?',
                remote: status.remoteVersion || '?',
              })}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t('addonManager.updates.summary', {
                changed: status.changedFiles,
                removed: status.removedFiles,
                size: formatSize(status.downloadBytes),
              })}
            </p>
          </div>

          {!status.hasUpdate && (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {t('addonManager.updates.upToDate')}
            </p>
          )}
        </div>
      )}

      {applyMutation.isPending && (
        <div className="flex flex-col gap-2 py-4">
          <Progress value={progressPercent} className="h-1.5" />
          <p className="truncate text-xs text-muted-foreground">{currentFile}</p>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 py-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {t('addonManager.updates.done', {
            version: result.version,
            updated: result.updatedFiles,
            removed: result.removedFiles,
          })}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {applyMutation.isPending ? (
          <Button variant="outline" size="sm" onClick={handleCancel}>
            {t('addonManager.installer.cancel')}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('common.close')}
            </Button>
            {status?.hasUpdate && !result && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => applyMutation.mutate({ type, folderName })}
              >
                <Download className="h-4 w-4" />
                {t('addonManager.updates.apply')}
              </Button>
            )}
          </>
        )}
      </div>
    </DialogContent>
  );
}

export function UpdateDialog({ target, onClose }: UpdateDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <UpdateDialogBody
          key={`${target.type}:${target.folderName}`}
          target={target}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}
