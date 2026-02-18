import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppVersion } from '@/hooks/useAppVersion';
import type { LoadingProgress } from '@/types/xplane';

interface LoadingStep {
  id: string;
  labelKey: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  count?: number;
}

interface LoadingScreenProps {
  onComplete: () => void;
  onError?: (error: string) => void;
  onConfigurePath?: () => void;
}

export default function LoadingScreen({
  onComplete,
  onError,
  onConfigurePath,
}: LoadingScreenProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const [steps, setSteps] = useState<LoadingStep[]>([
    { id: 'airports', labelKey: 'loading.steps.airports', status: 'pending' },
    { id: 'navaids', labelKey: 'loading.steps.navaids', status: 'pending' },
    { id: 'waypoints', labelKey: 'loading.steps.waypoints', status: 'pending' },
    { id: 'airspaces', labelKey: 'loading.steps.airspaces', status: 'pending' },
    { id: 'airways', labelKey: 'loading.steps.airways', status: 'pending' },
  ]);
  const [currentMessage, setCurrentMessage] = useState(() => t('loading.initializing'));
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid stale closure issues
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const hasStartedRef = useRef(false);
  const tRef = useRef(t);

  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    tRef.current = t;
  }, [onComplete, onError, t]);

  useEffect(() => {
    // Handle progress events
    function handleProgress(progress: LoadingProgress) {
      setCurrentMessage(progress.message);

      if (progress.status === 'error') {
        setError(progress.error || progress.message);
        onErrorRef.current?.(progress.error || progress.message);
        return;
      }

      if (progress.step === 'complete') {
        onCompleteRef.current();
        return;
      }

      setSteps((prev) =>
        prev.map((step) => {
          if (step.id === progress.step) {
            return { ...step, status: progress.status, count: progress.count };
          }
          return step;
        })
      );
    }

    // Register listener
    const cleanup = window.appAPI.onLoadingProgress(handleProgress);

    // Start loading
    async function startLoad() {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        const status = await window.appAPI.getLoadingStatus();

        if (!status.xplanePath) {
          setError(tRef.current('loading.pathNotConfigured'));
          setCurrentMessage(tRef.current('loading.configurationRequired'));
          return;
        }

        // Check if data is already loaded (e.g., after hot reload)
        const dataStatus = status.status;
        if (
          dataStatus?.airports?.count > 0 &&
          dataStatus?.navaids?.count > 0 &&
          dataStatus?.waypoints?.count > 0
        ) {
          onCompleteRef.current();
          return;
        }

        const result = await window.appAPI.startLoading();

        // If loading returned success with status, data was loaded
        if (result.success && (result.status?.airports?.count ?? 0) > 0) {
          onCompleteRef.current();
          return;
        }

        if (!result.success && result.error && result.error !== 'Loading already in progress') {
          setError(result.error);
        }
      } catch (err) {
        window.appAPI.log.error('Loading failed', err);
        setError((err as Error).message);
      }
    }

    startLoad();

    return cleanup;
  }, []); // Empty deps - only run once

  const completedSteps = steps.filter((s) => s.status === 'complete').length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-8">
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="xp-page-heading mb-2">{t('loading.title')}</h1>
          <Badge variant="info" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('loading.badge')}
          </Badge>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="mb-8 h-1.5" />

        {/* Steps list */}
        <div className="mb-6 space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center">
                  {step.status === 'loading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {step.status === 'complete' && <Check className="h-4 w-4 text-success" />}
                  {step.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                  {step.status === 'pending' && (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    step.status === 'loading'
                      ? 'font-medium text-foreground'
                      : step.status === 'complete'
                        ? 'text-muted-foreground'
                        : step.status === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground/50'
                  }`}
                >
                  {t(step.labelKey)}
                </span>
              </div>

              {step.count !== undefined && step.status === 'complete' && (
                <span className="font-mono text-xs text-muted-foreground">
                  {step.count.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Current message */}
        <p className="text-center text-xs text-muted-foreground">{currentMessage}</p>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action buttons when there's an error */}
        {error && (
          <div className="mt-4 flex gap-2">
            {onConfigurePath && (
              <Button variant="outline" className="flex-1" onClick={onConfigurePath}>
                {t('loading.configureXPlanePath')}
              </Button>
            )}
            <Button className="flex-1" onClick={() => window.location.reload()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Version */}
        <p className="mt-8 text-center font-mono text-xs text-muted-foreground/50">
          {version && `v${version}`}
        </p>
      </div>
    </div>
  );
}
