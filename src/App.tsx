import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Map from './components/Map';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';
import ErrorScreen from './components/screens/ErrorScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import SetupScreen from './components/screens/SetupScreen';
import { FullScreenSpinner } from './components/ui/spinner';
import './i18n';
import type { Airport } from './lib/xplaneServices/dataService';
import { QueryProvider } from './queries';
import { initializeTheme } from './stores/themeStore';

type AppState = 'checking' | 'setup' | 'loading' | 'ready' | 'error';

initializeTheme();

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

  const handleLoadingError = useCallback((error: string) => {
    setLoadError(error);
  }, []);

  const handleConfigurePath = useCallback(() => {
    setAppState('setup');
  }, []);

  if (appState === 'checking') {
    return <FullScreenSpinner />;
  }

  if (appState === 'setup') {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  if (appState === 'loading') {
    return (
      <LoadingScreen
        onComplete={handleLoadingComplete}
        onError={handleLoadingError}
        onConfigurePath={handleConfigurePath}
      />
    );
  }

  if (appState === 'error') {
    return (
      <ErrorScreen
        title="Loading Failed"
        message={loadError || 'An unknown error occurred'}
        onConfigure={handleConfigurePath}
        configureLabel="Configure Path"
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-background">
      <SectionErrorBoundary name="Map">
        <Map airports={airports} />
      </SectionErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppContent />
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
