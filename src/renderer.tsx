import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
// Bundled typefaces: nothing is fetched from a font CDN at runtime.
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import * as Sentry from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import { initSentryContext } from '@/lib/sentry/sentryContext';
import { TRANSIENT_NET_ERROR_PATTERN } from '@/lib/sentry/transientNetErrors';
import App from './App';
import './index.css';

// Initialize app - check crash reports setting first
(async () => {
  try {
    // Packaged builds load index.html over file://, so the protocol can't tell
    // dev from production; a check for app:// kept Sentry off in every release.
    const sendCrashReports = await window.appAPI.getSendCrashReports();
    if (!import.meta.env.DEV && sendCrashReports) {
      Sentry.init(
        {
          dsn: 'https://0279f306474c382f68b1605fb27be652@o4508345478742016.ingest.de.sentry.io/4510878234837072',
          release: `x-dispatch@${await window.appAPI.getVersion()}`,
          integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
          ignoreErrors: [TRANSIENT_NET_ERROR_PATTERN],
          tracesSampleRate: 1.0,
          // The free plan holds 50 replays a month: keep them for sessions with an error.
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 1.0,
        },
        reactInit
      );
      initSentryContext();
    }
  } catch {
    // Config not available yet (first run), skip Sentry
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
