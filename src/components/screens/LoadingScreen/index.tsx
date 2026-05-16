import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Check, Database, Globe2, MapPin, RadioTower, Route } from 'lucide-react';
import { AppLogo } from '@/components/ui/AppLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useAppVersion } from '@/hooks/useAppVersion';
import { cn } from '@/lib/utils/helpers';
import type { LoadingDetail, LoadingProgress } from '@/types/xplane';
import {
  calculateLoadingProgress,
  clampDisplayedProgress,
  getLoadingDetailLabel,
  getLoadingMessage,
} from './progress';

interface LoadingStep {
  id: 'airports' | 'navaids' | 'waypoints' | 'airspaces' | 'airways';
  labelKey: string;
  icon: LucideIcon;
  status: 'pending' | 'loading' | 'complete' | 'error';
  count?: number;
  detail?: LoadingDetail;
}

interface LoadingScreenProps {
  onComplete: () => void;
  onConfigurePath?: () => void;
}

const INITIAL_STEPS: LoadingStep[] = [
  { id: 'airports', labelKey: 'loading.steps.airports', icon: Database, status: 'pending' },
  { id: 'navaids', labelKey: 'loading.steps.navaids', icon: RadioTower, status: 'pending' },
  { id: 'waypoints', labelKey: 'loading.steps.waypoints', icon: MapPin, status: 'pending' },
  { id: 'airspaces', labelKey: 'loading.steps.airspaces', icon: Globe2, status: 'pending' },
  { id: 'airways', labelKey: 'loading.steps.airways', icon: Route, status: 'pending' },
];

export default function LoadingScreen({ onComplete, onConfigurePath }: LoadingScreenProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const [steps, setSteps] = useState<LoadingStep[]>(INITIAL_STEPS);
  const [currentProgress, setCurrentProgress] = useState<LoadingProgress | null>(null);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [phase, setPhase] = useState<'verifying' | 'loading'>('verifying');
  const [verifyComplete, setVerifyComplete] = useState(false);

  // Use refs to avoid stale closure issues
  const onCompleteRef = useRef(onComplete);
  const hasStartedRef = useRef(false);
  const stepsRef = useRef(steps);
  const tRef = useRef(t);

  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
    tRef.current = t;
  }, [onComplete, t]);

  useEffect(() => {
    // Handle progress events
    function handleProgress(progress: LoadingProgress) {
      setCurrentProgress(progress);
      const message = getLoadingMessage(progress, tRef.current);

      if (progress.phase) {
        setPhase(progress.phase);
      }

      if (progress.status === 'error') {
        setError(progress.error || message);
        setErrorHint(progress.hint ?? null);
        return;
      }

      if (progress.step === 'complete') {
        setDisplayedProgress((prev) => clampDisplayedProgress(prev, 100, true));
        onCompleteRef.current();
        return;
      }

      let matchedStep = false;
      const nextSteps = stepsRef.current.map((step) => {
        if (step.id === progress.step) {
          matchedStep = true;
          return {
            ...step,
            status: progress.status,
            count: progress.count ?? step.count,
            detail: progress.detail,
          };
        }
        return step;
      });

      if (matchedStep) {
        stepsRef.current = nextSteps;
        setSteps(nextSteps);
        setDisplayedProgress((prev) =>
          clampDisplayedProgress(prev, calculateLoadingProgress(nextSteps))
        );
      }

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
          setCurrentProgress({
            step: 'config',
            status: 'error',
            messageKey: 'loading.configurationRequired',
          });
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

  const hasError = !!error;
  const isVerifying = phase === 'verifying' && !hasError;
  const currentMessage = currentProgress
    ? getLoadingMessage(currentProgress, t)
    : t('loading.initializing');

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-xl">
        {/* Logo + Title */}
        <div className="mb-7 text-center">
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

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="xp-label min-w-0 truncate text-foreground">{currentMessage}</p>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {Math.floor(displayedProgress)}%
            </span>
          </div>
          <Progress value={displayedProgress} className="h-1.5" />
        </div>

        <div className="divide-y divide-border/50 border-y border-border/50">
          {steps.map((step) => {
            const Icon = step.icon;
            const detailLabel = step.detail ? getLoadingDetailLabel(step.detail, t) : '';

            return (
              <div key={step.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        step.status === 'loading' && 'text-primary',
                        step.status === 'complete' && 'text-success',
                        step.status === 'error' && 'text-destructive',
                        step.status === 'pending' && 'text-muted-foreground/50'
                      )}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'xp-label truncate',
                            step.status === 'loading' && 'font-medium text-foreground',
                            step.status === 'complete' && 'text-foreground',
                            step.status === 'error' && 'text-destructive',
                            step.status === 'pending' && 'text-muted-foreground'
                          )}
                        >
                          {t(step.labelKey)}
                        </span>
                      </div>

                      {step.status === 'loading' && step.detail && (
                        <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {detailLabel}
                          {step.detail.total != null && (
                            <>
                              {' '}
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
                  </div>

                  <div className="flex h-6 min-w-10 shrink-0 items-center justify-end gap-2">
                    {step.count !== undefined && step.status === 'complete' && (
                      <span className="xp-value text-muted-foreground">
                        {step.count.toLocaleString()}
                      </span>
                    )}
                    {step.status === 'loading' && <Spinner className="text-primary" />}
                    {step.status === 'complete' && <Check className="h-4 w-4 text-success" />}
                    {step.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {step.status === 'pending' && (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {hasError && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {errorHint && <p className="mt-2 text-xs text-destructive/80">{t(errorHint)}</p>}
            </AlertDescription>
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
