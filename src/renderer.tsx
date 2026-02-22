import React from 'react';
import ReactDOM from 'react-dom/client';
import { init as sentryInit } from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import App from './App';
import './index.css';

sentryInit(
  {
    dsn: 'https://0279f306474c382f68b1605fb27be652@o4508345478742016.ingest.de.sentry.io/4510878234837072',
  },
  reactInit
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
