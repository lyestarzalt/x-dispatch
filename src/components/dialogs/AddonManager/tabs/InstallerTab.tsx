// src/components/dialogs/AddonManager/tabs/InstallerTab.tsx
// Drop an archive or folder, review every add-on found in it, install the ones picked.
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import type {
  InstallProgress,
  InstallResult,
  InstallTask,
} from '@/lib/addonManager/installer/types';
import {
  addonDetectReason,
  addonInstallError,
  addonSource,
  addonTypeId,
} from '@/lib/analytics/addons';
import { cn } from '@/lib/utils/helpers';
import {
  InstallerRequestError,
  useInstallerAnalyze,
  useInstallerInstall,
  useInstallerPrepare,
} from '@/queries/useAddonManager';
import { trackEvent } from '@/queries/useAnalytics';
import type { ArchivePasswordPrompt } from '../components/ArchivePasswordDialog';
import { ArchivePasswordDialog } from '../components/ArchivePasswordDialog';
import { DetectedItemCard } from '../components/DetectedItemCard';
import { DropZone } from '../components/DropZone';

/** Wrong passwords allowed before the drop is given up on. */
const MAX_PASSWORD_ATTEMPTS = 3;

export function InstallerTab() {
  const { t } = useTranslation();
  // Every add-on found in the drop, with where it goes and what it replaces
  const [tasks, setTasks] = useState<InstallTask[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [results, setResults] = useState<InstallResult[] | null>(null);
  // X-Plane registers new scenery in scenery_packs.ini itself; the app never edits that file.
  const [installedScenery, setInstalledScenery] = useState(false);

  // The last drop: its paths, and whether they held no add-on at all.
  const [drop, setDrop] = useState<{ paths: string[]; noAddon: boolean } | null>(null);

  // An encrypted drop waiting for its password, and the passwords typed this session.
  const [passwordPrompt, setPasswordPrompt] = useState<ArchivePasswordPrompt | null>(null);
  const [passwordGivenUp, setPasswordGivenUp] = useState(false);
  const passwords = useRef<Record<string, string>>({});

  const analyzeMutation = useInstallerAnalyze();
  const prepareMutation = useInstallerPrepare();
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

  /** The usage event names the first path's kind; the drop is one event however many files. */
  const analyze = useCallback(
    async (paths: string[], attempts: number) => {
      const firstPath = paths[0] ?? '';
      try {
        const items = await analyzeMutation.mutateAsync({
          filePaths: paths,
          passwords: passwords.current,
        });
        setPasswordPrompt(null);
        const prepared = items.length ? await prepareMutation.mutateAsync(items) : [];
        setTasks(prepared);
        setSelected(Object.fromEntries(prepared.map((task) => [task.id, true])));
        setDrop({ paths, noAddon: prepared.length === 0 });
        trackEvent('addon_detected', {
          result: prepared.length ? 'recognized' : 'unrecognized',
          reason: prepared.length ? null : 'no_addon_found',
          source: addonSource(firstPath, items[0]?.sourceFormat === 'folder'),
          files: paths.length,
        });
      } catch (e) {
        const error = e instanceof InstallerRequestError ? e : null;
        // The archive that needs the password, among the dropped ones
        const lockedPath = error?.details.path ? String(error.details.path) : firstPath;
        if (error?.code === 'PASSWORD_REQUIRED') {
          setPasswordPrompt({ path: lockedPath, attempts });
          return;
        }
        if (error?.code === 'INVALID_PASSWORD' && attempts + 1 < MAX_PASSWORD_ATTEMPTS) {
          setPasswordPrompt({ path: lockedPath, attempts: attempts + 1 });
          return;
        }
        // Error shown from the mutation state
        setPasswordPrompt(null);
        setPasswordGivenUp(error?.code === 'INVALID_PASSWORD');
        trackEvent('addon_detected', {
          result: 'error',
          reason: addonDetectReason(error?.code),
          source: addonSource(firstPath, error?.folder),
          files: paths.length,
        });
      }
    },
    [analyzeMutation, prepareMutation]
  );

  const handleFilesDropped = async (paths: string[]) => {
    if (paths.length === 0) return;
    setResults(null);
    setPasswordGivenUp(false);
    setDrop({ paths, noAddon: false });
    await analyze(paths, 0);
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!passwordPrompt) return;
    passwords.current[passwordPrompt.path] = password;
    await analyze(drop?.paths ?? [passwordPrompt.path], passwordPrompt.attempts);
  };

  const handlePasswordCancel = () => {
    if (passwordPrompt) delete passwords.current[passwordPrompt.path];
    setPasswordPrompt(null);
    analyzeMutation.reset();
    setDrop(null);
  };

  const setInstallMode = (id: string, mode: 'overwrite' | 'clean') => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, installMode: mode } : task))
    );
  };

  const chosenTasks = tasks.filter((task) => selected[task.id]);

  const handleInstall = async () => {
    if (chosenTasks.length === 0) return;
    try {
      setProgress(null);
      setResults(null);
      const installResults = await installMutation.mutateAsync(chosenTasks);
      for (const task of chosenTasks) {
        const result = installResults.find((r) => r.taskId === task.id);
        const installed = result?.success ?? false;
        trackEvent('addon_installed', {
          type: addonTypeId(task.addonType),
          success: installed,
          error_code: installed ? null : addonInstallError(result?.errorCode),
        });
      }
      setInstalledScenery(
        chosenTasks.some(
          (task) =>
            (task.addonType === 'Scenery' || task.addonType === 'SceneryLibrary') &&
            installResults.find((r) => r.taskId === task.id)?.success
        )
      );
      setResults(installResults);
      setProgress(null);
    } catch (e) {
      for (const task of chosenTasks) {
        trackEvent('addon_installed', {
          type: addonTypeId(task.addonType),
          success: false,
          error_code: addonInstallError(e instanceof InstallerRequestError ? e.code : undefined),
        });
      }
      setProgress(null);
    }
  };

  const handleClear = () => {
    setTasks([]);
    setSelected({});
    setResults(null);
    setProgress(null);
    setDrop(null);
    setPasswordGivenUp(false);
    analyzeMutation.reset();
    prepareMutation.reset();
    installMutation.reset();
  };

  /** The message for an installer code, falling back to what main said. */
  const errorText = (code: string | undefined, fallback: string, params = {}) =>
    code
      ? t(`addonManager.installer.errors.${code}`, { ...params, defaultValue: fallback })
      : fallback;

  const analysisErrorText = (error: unknown) => {
    if (passwordGivenUp) return t('addonManager.installer.password.tooMany');
    if (error instanceof InstallerRequestError) {
      return errorText(error.code, error.message, error.details);
    }
    return error instanceof Error ? error.message : t('addonManager.installer.analysisFailed');
  };

  const isInstalling = installMutation.isPending;
  const isAnalyzing = analyzeMutation.isPending || prepareMutation.isPending;
  const isDisabled = isInstalling || isAnalyzing;
  const hasItems = tasks.length > 0;
  const analysisError = analyzeMutation.error ?? prepareMutation.error;
  const showAnalysisError = analysisError !== null && passwordPrompt === null;
  const succeeded = results?.filter((r) => r.success).length ?? 0;
  const resultNames = new Map(tasks.map((task) => [task.id, task.displayName]));

  return (
    <div className="flex h-full flex-col">
      <ArchivePasswordDialog
        prompt={passwordPrompt}
        maxAttempts={MAX_PASSWORD_ATTEMPTS}
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
      />

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Drop zone - always full size, hidden during install */}
        {!isInstalling && !results && (
          <div className="p-4">
            <DropZone onFilesDropped={handleFilesDropped} disabled={isDisabled} />
          </div>
        )}

        {/* Analyzing state */}
        {isAnalyzing && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="border-primary/20 h-16 w-16 rounded-full border-2" />
              <Spinner className="text-primary absolute inset-0 m-auto size-8" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{t('addonManager.installer.analyzing')}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('addonManager.installer.analyzingHint')}
              </p>
            </div>
          </div>
        )}

        {/* Analysis error */}
        {showAnalysisError && (
          <div className="px-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{analysisErrorText(analysisError)}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* The archive opened but held nothing X-Plane can use */}
        {drop?.noAddon && !isAnalyzing && !showAnalysisError && (
          <div className="px-4">
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('addonManager.installer.noAddonFound')}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Detected items */}
        {hasItems && !isInstalling && !results && (
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Package className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-muted-foreground truncate text-sm">
                  {tasks.length === 1
                    ? t('addonManager.installer.detectedOne')
                    : t('addonManager.installer.detectedMany', { count: tasks.length })}
                  {' · '}
                  {formatSize(tasks.reduce((sum, task) => sum + task.estimatedSize, 0))}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isDisabled}
                className="text-muted-foreground hover:text-destructive shrink-0 gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t('addonManager.installer.clear')}
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 pr-3">
                {tasks.map((task) => (
                  <DetectedItemCard
                    key={task.id}
                    item={task}
                    selected={tasks.length > 1 ? (selected[task.id] ?? false) : undefined}
                    onSelectedChange={
                      tasks.length > 1
                        ? (value) => setSelected((s) => ({ ...s, [task.id]: value }))
                        : undefined
                    }
                    onInstallModeChange={(mode) => setInstallMode(task.id, mode)}
                  />
                ))}
              </div>
            </ScrollArea>
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
                <Sparkles className="text-primary h-4 w-4" />
                <span className="text-sm font-medium">
                  {progress.totalTasks > 1
                    ? t('addonManager.installer.progress', {
                        current: Math.min(progress.currentTaskIndex + 1, progress.totalTasks),
                        total: progress.totalTasks,
                      })
                    : t('addonManager.installer.installing')}
                </span>
              </div>
              <Progress value={progress.overallPercent} className="h-1.5" />
              <p className="text-muted-foreground truncate text-xs">
                {progress.currentTaskName}
                {progress.currentFile && (
                  <span className="mt-0.5 block opacity-70">{progress.currentFile}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Installation results */}
        {results && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8">
            <div
              className={cn(
                'flex min-h-0 w-full max-w-md flex-col rounded-lg border p-6',
                succeeded === results.length
                  ? 'border-success/30 bg-success/5'
                  : succeeded > 0
                    ? 'border-warning/30 bg-warning/5'
                    : 'border-destructive/30 bg-destructive/5'
              )}
            >
              <div className="text-center">
                <div
                  className={cn(
                    'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full',
                    succeeded > 0 ? 'bg-success/20' : 'bg-destructive/20'
                  )}
                >
                  {succeeded > 0 ? (
                    <CheckCircle2 className="text-success h-7 w-7" />
                  ) : (
                    <XCircle className="text-destructive h-7 w-7" />
                  )}
                </div>
                <h3
                  className={cn(
                    'text-lg font-semibold',
                    succeeded === results.length
                      ? 'text-success'
                      : succeeded > 0
                        ? 'text-warning'
                        : 'text-destructive'
                  )}
                >
                  {succeeded === results.length
                    ? results.length === 1
                      ? t('addonManager.installer.successOne')
                      : t('addonManager.installer.successMany', { count: results.length })
                    : succeeded > 0
                      ? t('addonManager.installer.partialSuccess', {
                          success: succeeded,
                          total: results.length,
                        })
                      : t('addonManager.installer.installFailed')}
                </h3>
                {succeeded > 0 && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('addonManager.installer.successHint')}
                  </p>
                )}
                {installedScenery && (
                  <p className="text-warning mt-2 text-sm">
                    {t('addonManager.installer.successSceneryHint')}
                  </p>
                )}
              </div>

              <ScrollArea className="mt-4 min-h-0">
                <ul className="space-y-2 pr-3">
                  {results.map((result) => (
                    <li key={result.taskId} className="flex items-start gap-2 text-sm">
                      {result.success ? (
                        <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          {resultNames.get(result.taskId) ?? result.taskId}
                        </p>
                        {!result.success && (
                          <p className="text-destructive/80 text-xs">
                            {errorText(result.errorCode, result.error ?? '')}
                          </p>
                        )}
                        {result.backupPath && (
                          <p
                            className="text-muted-foreground truncate font-mono text-xs"
                            title={result.backupPath}
                          >
                            {t('addonManager.installer.review.backedUp', {
                              path: result.backupPath,
                            })}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="mt-4 self-center"
              >
                {t('addonManager.installer.installMore')}
              </Button>
            </div>
          </div>
        )}

        {/* Install error */}
        {installMutation.isError && !results && (
          <div className="px-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {installMutation.error instanceof InstallerRequestError
                  ? errorText(
                      installMutation.error.code,
                      installMutation.error.message,
                      installMutation.error.details
                    )
                  : installMutation.error instanceof Error
                    ? installMutation.error.message
                    : t('addonManager.installer.installFailed')}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Install button - sticky at bottom */}
      {hasItems && !isInstalling && !results && (
        <div className="border-border bg-card/50 border-t p-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleInstall}
            disabled={isDisabled || chosenTasks.length === 0}
            title={
              chosenTasks.length === 0 ? t('addonManager.installer.review.noneSelected') : undefined
            }
          >
            <Download className="h-5 w-5" />
            {chosenTasks.length <= 1
              ? t('addonManager.installer.installOne')
              : t('addonManager.installer.installMany', { count: chosenTasks.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
