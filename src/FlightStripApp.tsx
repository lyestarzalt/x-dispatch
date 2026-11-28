import { MotionConfig } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FlightStripWindow } from './components/FlightStripWindow';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import './i18n';
import { QueryProvider } from './queries';
import { initializeFontSize } from './stores/settingsStore';
import { initializeTheme } from './stores/themeStore';

document.body.style.background = 'transparent';
initializeTheme();
initializeFontSize();

/**
 * Root of the detached flight strip window. Kept apart from App so the strip
 * window never loads the map, the dialogs or the rest of the main window.
 */
export default function FlightStripApp() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={500} skipDelayDuration={300}>
            <FlightStripWindow />
            <Toaster position="top-center" />
          </TooltipProvider>
        </MotionConfig>
      </QueryProvider>
    </ErrorBoundary>
  );
}
