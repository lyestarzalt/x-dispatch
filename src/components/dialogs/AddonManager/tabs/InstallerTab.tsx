// src/components/dialogs/AddonManager/tabs/InstallerTab.tsx
// Single addon installer - one at a time for simplicity
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Package,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import type {
  DetectedItem,
  InstallProgress,
  InstallResult,
} from '@/lib/addonManager/installer/types';
import { cn } from '@/lib/utils/helpers';
import { useInstallerAnalyze, useInstallerInstall } from '@/queries/useAddonManager';
import { DetectedItemCard } from '../components/DetectedItemCard';
import { DropZone } from '../components/DropZone';

export function InstallerTab() {
  const { t } = useTranslation();
  // Single item only
  const [detectedItem, setDetectedItem] = useState<DetectedItem | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [result, setResult] = useState<InstallResult | null>(null);

  const analyzeMutation = useInstallerAnalyze();
  const installMutation = useInstallerInstall();

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = window.addonManagerAPI.installer.onProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const handleFilesDropped = async (paths: string[]) => {
    try {
      setResult(null);
      // Only take the first file
      const firstPath = paths[0];
      if (!firstPath) return;
      const items = await analyzeMutation.mutateAsync([firstPath]);
      // Only use the first detected item
      setDetectedItem(items[0] || null);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleInstall = async () => {
    if (!detectedItem) return;
    try {
      setProgress(null);
      setResult(null);
      const installResults = await installMutation.mutateAsync([detectedItem]);
      setResult(installResults[0] || null);
      setProgress(null);
      // Clear item after successful install
      if (installResults[0]?.success) {
        setDetectedItem(null);
      }
    } catch {
      setProgress(null);
    }
  };

  const handleClear = () => {
    setDetectedItem(null);
    setResult(null);
    setProgress(null);
    analyzeMutation.reset();
    installMutation.reset();
  };

  const isInstalling = installMutation.isPending;
  const isAnalyzing = analyzeMutation.isPending;
  const isDisabled = isInstalling || isAnalyzing;
  const hasItem = detectedItem !== null;

  return (
    <div className="flex h-full flex-col">
      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Drop zone - always full size, hidden during install */}
        {!isInstalling && !result && (
          <div className="p-4">
            <DropZone onFilesDropped={handleFilesDropped} disabled={isDisabled} />
          </div>
        )}

        {/* Analyzing state */}
        {isAnalyzing && (
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

        {/* Analysis error */}
        {analyzeMutation.isError && (
          <div className="px-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {analyzeMutation.error instanceof Error
                  ? analyzeMutation.error.message
                  : t('addonManager.installer.analysisFailed')}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Detected item */}
        {hasItem && !isInstalling && !result && (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {formatSize(detectedItem.estimatedSize)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isDisabled}
                className="gap-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t('addonManager.installer.clear')}
              </Button>
            </div>
            <DetectedItemCard item={detectedItem} />
          </div>
        )}

        {/* Installation progress */}
        {isInstalling && progress && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="relative h-24 w-24">
              {/* Circular progress background */}
              <svg className="h-full w-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={276.46}
                  strokeDashoffset={276.46 - (276.46 * progress.overallPercent) / 100}
                  className="text-primary transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold tabular-nums">{progress.overallPercent}%</span>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t('addonManager.installer.installing')}
                </span>
              </div>
              <Progress value={progress.overallPercent} className="h-1.5" />
              <p className="truncate text-xs text-muted-foreground">
                {progress.currentTaskName}
                {progress.currentFile && (
                  <span className="mt-0.5 block opacity-70">{progress.currentFile}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Installation result */}
        {result && (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div
              className={cn(
                'w-full max-w-sm rounded-xl border p-6 text-center',
                result.success
                  ? 'border-success/30 bg-success/5'
                  : 'border-destructive/30 bg-destructive/5'
              )}
            >
              <div
                className={cn(
                  'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full',
                  result.success ? 'bg-success/20' : 'bg-destructive/20'
                )}
              >
                {result.success ? (
                  <CheckCircle2 className="h-7 w-7 text-success" />
                ) : (
                  <XCircle className="h-7 w-7 text-destructive" />
                )}
              </div>

              {result.success ? (
                <>
                  <h3 className="text-lg font-semibold text-success">
                    {t('addonManager.installer.successOne')}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('addonManager.installer.successHint')}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-destructive">
                    {t('addonManager.installer.installFailed')}
                  </h3>
                  <p className="mt-2 text-sm text-destructive/80">{result.error}</p>
                </>
              )}

              <Button variant="outline" size="sm" onClick={handleClear} className="mt-4">
                {t('addonManager.installer.installMore')}
              </Button>
            </div>
          </div>
        )}

        {/* Install error */}
        {installMutation.isError && !result && (
          <div className="px-4">
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

      {/* Install button - sticky at bottom */}
      {hasItem && !isInstalling && !result && (
        <div className="border-t border-border bg-card/50 p-4">
          <Button
            className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            size="lg"
            onClick={handleInstall}
            disabled={isDisabled}
          >
            <Download className="h-5 w-5" />
            {t('addonManager.installer.installOne')}
          </Button>
        </div>
      )}
    </div>
  );
}
