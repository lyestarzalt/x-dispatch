// src/components/dialogs/AddonManager/tabs/InstallerTab.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Download, Sparkles, Trash2, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import type {
  InstallProgress,
  InstallResult,
  InstallTask,
} from '@/lib/addonManager/installer/types';
import {
  useInstallerAnalyze,
  useInstallerInstall,
  useInstallerPrepare,
} from '@/queries/useAddonManager';
import { DropZone } from '../components/DropZone';
import { type InstallMode, InstallReviewRow, type RowStatus } from '../components/InstallReviewRow';

type Phase = 'idle' | 'review' | 'installing' | 'done';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function InstallerTab() {
  const { t } = useTranslation();

  const [tasks, setTasks] = useState<InstallTask[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState<Record<string, InstallMode>>({});
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [results, setResults] = useState<InstallResult[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const analyzeMutation = useInstallerAnalyze();
  const prepareMutation = useInstallerPrepare();
  const installMutation = useInstallerInstall();

  useEffect(() => {
    return window.addonManagerAPI.installer.onProgress(setProgress);
  }, []);

  const phase: Phase = installMutation.isPending
    ? 'installing'
    : results.length > 0
      ? 'done'
      : tasks.length > 0
        ? 'review'
        : 'idle';

  const isBusy =
    analyzeMutation.isPending || prepareMutation.isPending || installMutation.isPending;

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selected.has(task.id)),
    [tasks, selected]
  );
  const selectedSize = selectedTasks.reduce((sum, task) => sum + task.estimatedSize, 0);

  const resultById = useMemo(
    () => new Map(results.map((result) => [result.taskId, result])),
    [results]
  );

  const handleFilesDropped = async (paths: string[]) => {
    try {
      setResults([]);
      const items = await analyzeMutation.mutateAsync(paths);
      if (items.length === 0) {
        setTasks([]);
        return;
      }
      const prepared = await prepareMutation.mutateAsync(items);
      setTasks(prepared);
      setSelected(new Set(prepared.map((task) => task.id)));
      setModes(Object.fromEntries(prepared.map((task) => [task.id, 'overwrite' as InstallMode])));
    } catch {
      // Surfaced through the mutation's error state
    }
  };

  const handleInstall = async () => {
    if (selectedTasks.length === 0) return;
    setProgress(null);
    setResults([]);
    setCancelling(false);
    try {
      const installResults = await installMutation.mutateAsync({
        items: selectedTasks,
        modes: Object.fromEntries(
          selectedTasks.map((task) => [task.id, modes[task.id] ?? 'overwrite'])
        ),
      });
      setResults(installResults);
    } catch {
      // Surfaced through the mutation's error state
    } finally {
      setProgress(null);
      setCancelling(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    await window.addonManagerAPI.installer.cancel();
  };

  const handleClear = () => {
    setTasks([]);
    setSelected(new Set());
    setModes({});
    setResults([]);
    setProgress(null);
    analyzeMutation.reset();
    prepareMutation.reset();
    installMutation.reset();
  };

  const runningTaskId =
    phase === 'installing' && progress ? selectedTasks[progress.currentTaskIndex]?.id : undefined;

  const visibleTasks = phase === 'idle' || phase === 'review' ? tasks : selectedTasks;

  const rowStatus = (taskId: string): RowStatus => {
    if (phase === 'done') return 'done';
    if (phase !== 'installing') return 'pending';
    return taskId === runningTaskId ? 'running' : 'done';
  };

  const rows = visibleTasks.map((task) => ({
    task,
    status: rowStatus(task.id),
    mode: modes[task.id] ?? ('overwrite' as InstallMode),
  }));

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col overflow-hidden">
        {phase === 'idle' && !isBusy && (
          <div className="p-4">
            <DropZone onFilesDropped={handleFilesDropped} disabled={isBusy} />
          </div>
        )}

        {isBusy && phase !== 'installing' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-primary/20" />
              <Spinner className="absolute inset-0 m-auto size-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{t('addonManager.installer.analyzing')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('addonManager.installer.analyzingHint')}
              </p>
            </div>
          </div>
        )}

        {(analyzeMutation.isError || prepareMutation.isError) && (
          <div className="px-4 pb-2">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(analyzeMutation.error ?? prepareMutation.error) instanceof Error
                  ? (analyzeMutation.error ?? prepareMutation.error)!.message
                  : t('addonManager.installer.analysisFailed')}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {phase === 'installing' && progress && (
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                {cancelling
                  ? t('addonManager.installer.cancelling')
                  : t('addonManager.installer.progress', {
                      current: Math.min(progress.currentTaskIndex + 1, selectedTasks.length),
                      total: selectedTasks.length,
                    })}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {progress.overallPercent}%
              </span>
            </div>
            <Progress value={progress.overallPercent} className="h-1.5" />
            {progress.currentFile && (
              <p className="mt-1.5 truncate text-xs text-muted-foreground">
                {progress.currentFile}
              </p>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium">
              {t('addonManager.installer.resultsSummary', {
                succeeded,
                failed,
                skipped,
              })}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-4">
              {rows.map(({ task, status, mode }) => (
                <InstallReviewRow
                  key={task.id}
                  task={task}
                  selected={selected.has(task.id)}
                  mode={mode}
                  status={status}
                  result={resultById.get(task.id)}
                  disabled={isBusy}
                  onSelectedChange={(isSelected) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (isSelected) next.add(task.id);
                      else next.delete(task.id);
                      return next;
                    })
                  }
                  onModeChange={(next) => setModes((current) => ({ ...current, [task.id]: next }))}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {installMutation.isError && (
          <div className="px-4 pb-2">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {installMutation.error instanceof Error
                  ? installMutation.error.message
                  : t('addonManager.installer.installFailed')}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {phase === 'review' && (
        <div className="flex items-center gap-2 border-t border-border bg-card/50 p-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {t('addonManager.installer.selectionSummary', {
              count: selectedTasks.length,
              size: formatSize(selectedSize),
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isBusy}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {t('addonManager.installer.clear')}
          </Button>
          <Button
            size="lg"
            className="gap-2"
            onClick={handleInstall}
            disabled={isBusy || selectedTasks.length === 0}
          >
            <Download className="h-5 w-5" />
            {t('addonManager.installer.installSelected', { count: selectedTasks.length })}
          </Button>
        </div>
      )}

      {phase === 'installing' && (
        <div className="flex justify-end border-t border-border bg-card/50 p-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleCancel}
            disabled={cancelling}
          >
            <X className="h-4 w-4" />
            {cancelling
              ? t('addonManager.installer.cancelling')
              : t('addonManager.installer.cancel')}
          </Button>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex justify-end border-t border-border bg-card/50 p-4">
          <Button variant="outline" size="sm" onClick={handleClear}>
            {t('addonManager.installer.installMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
