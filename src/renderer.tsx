import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import App from './App';
import './index.css';

// Initialize app - check crash reports setting first
(async () => {
  try {
    const sendCrashReports = await window.appAPI.getSendCrashReports();
    if (sendCrashReports) {
      Sentry.init(
        {
          dsn: 'https://93939f3ad736f402a616188303a369cf@o4510928623173632.ingest.de.sentry.io/4510928631365712',
          release: `x-dispatch@${await window.appAPI.getVersion()}`,
          integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
          tracesSampleRate: 1.0,
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        },
        reactInit
      );
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
