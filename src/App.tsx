import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import Map from './components/Map';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';
import { TitleBar } from './components/TitleBar';
import ErrorScreen from './components/screens/ErrorScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import SetupScreen from './components/screens/SetupScreen';
import { FullScreenSpinner } from './components/ui/spinner';
import { TooltipProvider } from './components/ui/tooltip';
import './i18n';
import type { Airport } from './lib/xplaneServices/dataService';
import { QueryProvider } from './queries';
import { initializeFontSize } from './stores/settingsStore';
import { initializeTheme } from './stores/themeStore';

type AppState = 'checking' | 'setup' | 'loading' | 'ready' | 'error';

initializeTheme();
initializeFontSize();

function AppContent() {
  const [appState, setAppState] = useState<AppState>('checking');
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function checkSetup() {
      try {
        const isComplete = await window.appAPI.isSetupComplete();
        if (isComplete) {
          setAppState('loading');
        } else {
          setAppState('setup');
        }
      } catch {
        setAppState('setup');
      }
    }
    checkSetup();
  }, []);

  const handleSetupComplete = useCallback(() => {
    setAppState('loading');
  }, []);

  const handleLoadingComplete = useCallback(async () => {
    try {
      const data = await window.airportAPI.getAirports();
      setAirports(data);
      setAppState('ready');
    } catch (err) {
      window.appAPI.log.error('Failed to fetch airports after loading', err);
      setLoadError((err as Error).message);
      setAppState('error');
    }
  }, []);

  const handleConfigurePath = useCallback(() => {
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
      </SectionErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster position="bottom-center" theme="dark" />
        </TooltipProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
