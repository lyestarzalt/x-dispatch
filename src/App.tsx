import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Map from './components/Map';
import LoadingScreen from './components/screens/LoadingScreen';
import SetupScreen from './components/screens/SetupScreen';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
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
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
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
      <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Loading Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{loadError}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleConfigurePath}>
                Configure Path
              </Button>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background">
      <Map airports={airports} />
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
