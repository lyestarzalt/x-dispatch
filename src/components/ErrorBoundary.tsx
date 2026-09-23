import { Component, ErrorInfo, ReactNode } from 'react';
import { type WithTranslation, withTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    try {
      window.appAPI?.log.error('React Error Boundary caught error', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    } catch {
      // Ignore
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { t } = this.props;

      return (
        <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-6 p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertCircle className="text-destructive h-8 w-8" />
            </div>
            <h1 className="text-foreground text-xl font-semibold">{t('errorBoundary.title')}</h1>
            <p className="text-muted-foreground max-w-md text-center text-sm">
              {t('errorBoundary.description')}
            </p>
            {this.state.error && (
              <details className="mt-2 max-w-lg">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                  {t('errorBoundary.errorDetails')}
                </summary>
                <pre className="bg-muted text-muted-foreground mt-2 max-h-32 overflow-auto rounded p-2 text-xs">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('errorBoundary.tryAgain')}
            </Button>
            <Button onClick={this.handleReload} className="gap-2">
              {t('errorBoundary.reloadApp')}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
