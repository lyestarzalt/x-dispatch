import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check } from 'lucide-react';
import { AppLogo } from '@/components/ui/AppLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useAppVersion } from '@/hooks/useAppVersion';
import { cn } from '@/lib/utils/helpers';
import type { LoadingDetail, LoadingProgress } from '@/types/xplane';

interface LoadingStep {
  id: string;
  labelKey: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  count?: number;
  detail?: LoadingDetail;
}

const STEP_WEIGHTS: Record<string, number> = {
  airports: 0.6,
  navaids: 0.1,
  waypoints: 0.1,
  airspaces: 0.1,
  airways: 0.1,
};

interface LoadingScreenProps {
  onComplete: () => void;
  onConfigurePath?: () => void;
}

export default function LoadingScreen({ onComplete, onConfigurePath }: LoadingScreenProps) {
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
  const [phase, setPhase] = useState<'verifying' | 'loading'>('verifying');
  const [verifyComplete, setVerifyComplete] = useState(false);

  // Use refs to avoid stale closure issues
  const onCompleteRef = useRef(onComplete);
  const hasStartedRef = useRef(false);
  const tRef = useRef(t);

  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
    tRef.current = t;
  }, [onComplete, t]);

  useEffect(() => {
    // Handle progress events
    function handleProgress(progress: LoadingProgress) {
      setCurrentMessage(progress.message);

      if (progress.phase) {
        setPhase(progress.phase);
      }

      if (progress.status === 'error') {
        setError(progress.error || progress.message);
        return;
      }

      if (progress.step === 'complete') {
        onCompleteRef.current();
        return;
      }

      setSteps((prev) =>
        prev.map((step) => {
          if (step.id === progress.step) {
            return {
              ...step,
              status: progress.status,
              count: progress.count ?? step.count,
              detail: progress.detail,
            };
          }
          return step;
        })
      );

      // If all steps complete with cache valid (verifying phase), auto-complete after delay
      if (
        progress.phase === 'verifying' &&
        progress.step === 'airports' &&
        progress.status === 'complete'
      ) {
        setVerifyComplete(true);
      }
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
          dataStatus?.waypoints?.count > 0 &&
          dataStatus?.airspaces?.count > 0 &&
          dataStatus?.airways?.count > 0
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

  // Auto-complete after cache-valid verification
  useEffect(() => {
    if (!verifyComplete) return;
    const timer = setTimeout(() => {
      // Don't auto-complete — the main process will continue loading other steps
      // and will send a 'complete' event when all done
    }, 600);
    return () => clearTimeout(timer);
  }, [verifyComplete]);

  // Weighted progress calculation
  const weightedProgress = steps.reduce((acc, step) => {
    const weight = STEP_WEIGHTS[step.id] ?? 0;
    if (step.status === 'complete') return acc + weight * 100;
    if (step.status === 'loading' && step.detail?.total) {
      const subProgress = Math.min(step.detail.current / step.detail.total, 1);
      return acc + weight * subProgress * 100;
    }
    return acc;
  }, 0);

  const hasError = !!error;
  const isVerifying = phase === 'verifying' && !hasError;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-8">
        {/* Logo + Title */}
        <div className="mb-8 text-center">
          <AppLogo size="xl" className="mx-auto mb-4" />
          <h1 className="xp-page-heading mb-2">{t('loading.title')}</h1>
          {hasError ? (
            <Badge variant="danger" className="gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {t('loading.failed')}
            </Badge>
          ) : verifyComplete && isVerifying ? (
            <Badge variant="success" className="gap-1.5">
              <Check className="h-3 w-3" />
              {t('loading.upToDate')}
            </Badge>
          ) : (
            <Badge variant="info" className="gap-1.5">
              <Spinner className="size-3" />
              {isVerifying ? t('loading.verifying') : t('loading.badge')}
            </Badge>
          )}
        </div>

        {/* Progress bar — only shown in loading phase */}
        {!isVerifying && <Progress value={weightedProgress} className="mb-6 h-1.5" />}

        {/* Steps list — only shown in loading phase */}
        {!isVerifying && (
          <div className="mb-6 space-y-3">
            {steps.map((step) => (
              <div key={step.id}>
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {step.status === 'loading' && <Spinner className="text-primary" />}
                      {step.status === 'complete' && <Check className="h-4 w-4 text-success" />}
                      {step.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      {step.status === 'pending' && (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'xp-label truncate',
                        step.status === 'loading' && 'font-medium text-foreground',
                        step.status === 'complete' && 'text-muted-foreground',
                        step.status === 'error' && 'text-destructive',
                        step.status === 'pending' && 'text-muted-foreground/50'
                      )}
                    >
                      {t(step.labelKey)}
                    </span>
                  </div>

                  {step.count !== undefined && step.status === 'complete' && (
                    <span className="xp-value shrink-0 text-muted-foreground">
                      {step.count.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Detail sub-line for active step */}
                {step.status === 'loading' && step.detail && (
                  <div className="ml-8 mt-0.5 font-mono text-xs text-muted-foreground">
                    {step.detail.label}
                    {step.detail.total != null && (
                      <>
                        {'... '}
                        {step.detail.current.toLocaleString()}
                        {' / '}
                        {step.detail.total === step.detail.current
                          ? step.detail.total.toLocaleString()
                          : `~${step.detail.total.toLocaleString()}`}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Current message — only shown in verifying phase (loading phase has step list) */}
        {isVerifying && <p className="xp-label text-center">{currentMessage}</p>}

        {/* Error */}
        {hasError && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action buttons when there's an error */}
        {hasError && (
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
