// src/components/dialogs/AddonManager/tabs/InstallerTab.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  DetectedItem,
  InstallProgress,
  InstallResult,
} from '@/lib/addonManager/installer/types';
import { useInstallerAnalyze, useInstallerInstall } from '@/queries/useAddonManager';
import { DetectedItemCard } from '../components/DetectedItemCard';
import { DropZone } from '../components/DropZone';

export function InstallerTab() {
  const { t } = useTranslation();
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [results, setResults] = useState<InstallResult[] | null>(null);

  const analyzeMutation = useInstallerAnalyze();
  const installMutation = useInstallerInstall();

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = window.addonManagerAPI.installer.onProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const handleFilesDropped = async (paths: string[]) => {
    try {
      setResults(null);
      const items = await analyzeMutation.mutateAsync(paths);
      setDetectedItems(items);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleInstall = async () => {
    try {
      setProgress(null);
      setResults(null);
      const installResults = await installMutation.mutateAsync(detectedItems);
      setResults(installResults);
      setProgress(null);
      // Clear items after successful install
      if (installResults.every((r) => r.success)) {
        setDetectedItems([]);
      }
    } catch {
      setProgress(null);
    }
  };

  const handleClear = () => {
    setDetectedItems([]);
    setResults(null);
    setProgress(null);
    analyzeMutation.reset();
    installMutation.reset();
  };

  const isInstalling = installMutation.isPending;
  const isAnalyzing = analyzeMutation.isPending;
  const isDisabled = isInstalling || isAnalyzing;

  return (
    <div className="flex flex-col gap-4 p-4">
      <DropZone onFilesDropped={handleFilesDropped} disabled={isDisabled} />

      {isAnalyzing && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm">{t('addonManager.installer.analyzing')}</span>
        </div>
      )}

      {analyzeMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {analyzeMutation.error instanceof Error
              ? analyzeMutation.error.message
              : t('addonManager.installer.analysisFailed')}
          </AlertDescription>
        </Alert>
      )}

      {/* Progress indicator */}
      {isInstalling && progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t('addonManager.installer.progress', {
                current: progress.currentTaskIndex + 1,
                total: progress.totalTasks,
              })}
            </span>
            <span className="text-muted-foreground">{progress.overallPercent}%</span>
          </div>
          <Progress value={progress.overallPercent} className="h-2" />
          <p className="truncate text-xs text-muted-foreground">
            {progress.currentTaskName}
            {progress.currentFile && ` - ${progress.currentFile}`}
          </p>
        </div>
      )}

      {/* Installation results */}
      {results && (
        <Alert variant={results.every((r) => r.success) ? 'default' : 'destructive'}>
          {results.every((r) => r.success) ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {results.every((r) => r.success) ? (
              results.length === 1 ? (
                t('addonManager.installer.successOne')
              ) : (
                t('addonManager.installer.successMany', { count: results.length })
              )
            ) : (
              <div className="space-y-1">
                <span>
                  {t('addonManager.installer.partialSuccess', {
                    success: results.filter((r) => r.success).length,
                    total: results.length,
                  })}
                </span>
                {results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <p key={r.taskId} className="text-xs">
                      {t('addonManager.installer.failed', { error: r.error })}
                    </p>
                  ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {installMutation.isError && !results && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {installMutation.error instanceof Error
              ? installMutation.error.message
              : t('addonManager.installer.installFailed')}
          </AlertDescription>
        </Alert>
      )}

      {detectedItems.length > 0 && !isInstalling && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {detectedItems.length === 1
                ? t('addonManager.installer.detectedOne')
                : t('addonManager.installer.detectedMany', { count: detectedItems.length })}
            </h3>
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={isDisabled}>
              {t('addonManager.installer.clear')}
            </Button>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="flex flex-col gap-2 pr-4">
              {detectedItems.map((item) => (
                <DetectedItemCard key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>

          <Button className="w-full" onClick={handleInstall} disabled={isDisabled}>
            {isInstalling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('addonManager.installer.installing')}
              </>
            ) : detectedItems.length === 1 ? (
              t('addonManager.installer.installOne')
            ) : (
              t('addonManager.installer.installMany', { count: detectedItems.length })
            )}
          </Button>
        </>
      )}

      {detectedItems.length === 0 && !isAnalyzing && !results && (
        <p className="text-center text-sm text-muted-foreground">
          {t('addonManager.installer.emptyState')}
        </p>
      )}
    </div>
  );
}
