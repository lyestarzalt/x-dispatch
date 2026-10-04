import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FlightStripWindow } from './components/FlightStripWindow';
import Map from './components/Map';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';
import { TitleBar } from './components/TitleBar';
import { UpdateAvailableToast } from './components/UpdateAvailableToast';
import { AnalyticsConsentDialog } from './components/dialogs/AnalyticsConsentDialog';
import { RemoteConnectionBanner } from './components/remote/RemoteConnectionBanner';
import ErrorScreen from './components/screens/ErrorScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import SetupScreen from './components/screens/SetupScreen';
import { Toaster } from './components/ui/sonner';
import { FullScreenSpinner } from './components/ui/spinner';
import { TooltipProvider } from './components/ui/tooltip';
import './i18n';
import { startupBucket } from './lib/analytics/buckets';
import type { Airport } from './lib/xplaneServices/dataService';
import { QueryProvider, trackEvent } from './queries';
import { useAppStore } from './stores/appStore';
import { initializeFontSize, useSettingsStore } from './stores/settingsStore';
import { initializeTheme } from './stores/themeStore';

type AppState = 'checking' | 'setup' | 'loading' | 'ready' | 'error';

initializeTheme();
initializeFontSize();

function AppContent() {
  const [appState, setAppState] = useState<AppState>('checking');
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Startup time is only meaningful when no setup screen waited on the user.
  const setupShownRef = useRef(false);
  const startupReportedRef = useRef(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const isComplete = await window.appAPI.isSetupComplete();
        if (isComplete) {
          setAppState('loading');
        } else {
          setupShownRef.current = true;
          setAppState('setup');
        }
      } catch {
        setupShownRef.current = true;
        setAppState('setup');
      }
    }
    checkSetup();
  }, []);

  const handleSetupComplete = useCallback(() => {
    setAppState('loading');
  }, []);

  const handleLoadingComplete = useCallback(async (fromCache: boolean) => {
    try {
      const data = await window.airportAPI.getAirports();
      setAirports(data);
      setAppState('ready');
      if (!setupShownRef.current && !startupReportedRef.current) {
        startupReportedRef.current = true;
        trackEvent('app_ready', {
          startup: startupBucket(performance.now()),
          from_cache: fromCache,
        });
      }
    } catch (err) {
      window.appAPI.log.error('Failed to fetch airports after loading', err);
      setLoadError((err as Error).message);
      setAppState('error');
    }
  }, []);

  const handleConfigurePath = useCallback(() => {
    setupShownRef.current = true;
    setAppState('setup');
  }, []);

  // Refresh airports when custom scenery changes (via addon manager rescan)
  useEffect(() => {
    return window.appAPI.onAirportsUpdated(async () => {
      try {
        const data = await window.airportAPI.getAirports();
        setAirports(data);
      } catch (err) {
        window.appAPI.log.error('Failed to refresh airports after resync', err);
      }
    });
  }, []);

  // Auto-navigate to the user's home airport on first reach of 'ready'.
  // Reads settings imperatively (not as a reactive selector) so toggling
  // the setting later in the same session doesn't re-fire the nav. The
  // pendingAirportSelectionIcao pipeline silently no-ops if the ICAO
  // isn't in the cached airport list, so stale homes are safe.
  const didAutoNavigateRef = useRef(false);
  useEffect(() => {
    if (appState !== 'ready' || didAutoNavigateRef.current) return;
    const { homeIcao, autoNavigateHomeOnStart } = useSettingsStore.getState().airports;
    if (autoNavigateHomeOnStart && homeIcao) {
      useAppStore.getState().requestSelectAirport(homeIcao);
    }
    didAutoNavigateRef.current = true;
  }, [appState]);

  let content: ReactNode;
  if (appState === 'checking') {
    content = <FullScreenSpinner />;
  } else if (appState === 'setup') {
    content = <SetupScreen onComplete={handleSetupComplete} />;
  } else if (appState === 'loading') {
    content = (
      <LoadingScreen onComplete={handleLoadingComplete} onConfigurePath={handleConfigurePath} />
    );
  } else if (appState === 'error') {
    content = (
      <ErrorScreen
        title="Loading Failed"
        message={loadError || 'An unknown error occurred'}
        onConfigure={handleConfigurePath}
        configureLabel="Configure Path"
        onRetry={() => window.location.reload()}
      />
    );
  } else {
    content = (
      <SectionErrorBoundary name="Map">
        <Map airports={airports} />
        <AnalyticsConsentDialog />
      </SectionErrorBoundary>
    );
  }

  return (
    <div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar />
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
}

/** The detached flight strip is the same renderer opened with ?view=flight-strip. */
const isFlightStripView =
  new URLSearchParams(window.location.search).get('view') === 'flight-strip';

function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <MotionConfig reducedMotion="user">
          {/* Native tooltip cadence: a beat before the first one, instant between neighbors */}
          <TooltipProvider delayDuration={500} skipDelayDuration={300}>
            {isFlightStripView ? (
              <FlightStripWindow />
            ) : (
              <>
                <AppContent />
                <UpdateAvailableToast />
                <Toaster position="bottom-center" />
                <RemoteConnectionBanner />
              </>
            )}
          </TooltipProvider>
        </MotionConfig>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
