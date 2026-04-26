import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import App from './App';
import './index.css';

// Initialize app - check crash reports setting first
(async () => {
  try {
    const isProduction = window.location.protocol === 'app:';
    const sendCrashReports = await window.appAPI.getSendCrashReports();
    if (isProduction && sendCrashReports) {
      Sentry.init(
        {
          dsn: 'https://0279f306474c382f68b1605fb27be652@o4508345478742016.ingest.de.sentry.io/4510878234837072',
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
