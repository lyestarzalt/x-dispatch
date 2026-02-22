import React from 'react';
import ReactDOM from 'react-dom/client';
import { init as sentryInit } from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import App from './App';
import './index.css';

sentryInit(
  {
    dsn: 'https://93939f3ad736f402a616188303a369cf@o4510928623173632.ingest.de.sentry.io/4510928631365712',
  },
  reactInit
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
