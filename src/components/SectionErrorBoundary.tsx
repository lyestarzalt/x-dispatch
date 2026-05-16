import { Component, ErrorInfo, ReactNode } from 'react';
import { type WithTranslation, withTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
  name: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SectionErrorBoundaryInner extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
      tags: { section: this.props.name },
    });
    try {
      window.appAPI?.log.error(`Error in ${this.props.name}`, {
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

  render(): ReactNode {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">
              {t('errorBoundary.sectionFailed', { name: this.props.name })}
            </span>
          </div>
          {this.state.error && (
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={this.handleReset} className="gap-2">
            <RefreshCw className="h-3 w-3" />
            {t('errorBoundary.retry')}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const SectionErrorBoundary = withTranslation()(SectionErrorBoundaryInner);
