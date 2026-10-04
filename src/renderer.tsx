import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
// Bundled typefaces: nothing is fetched from a font CDN at runtime.
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './index.css';

// A file dropped outside a drop zone would otherwise navigate the window to it.
for (const type of ['dragover', 'drop'] as const) {
  document.addEventListener(type, (e) => e.preventDefault());
}

// In a browser on another device (tablet access) there is no preload: install
// window.*API over a WebSocket first. The dynamic import keeps every app module
// from evaluating before the bridge exists.
if (!('appAPI' in window)) {
  const { installRemoteBridge } = await import('./lib/bridge/browser/installRemoteBridge');
  installRemoteBridge();
}
try {
  const { bootstrap } = await import('./bootstrap');
  void bootstrap();
} catch (err) {
  // Nothing has rendered yet, so a failed import would leave a blank page.
  // Content blockers are the usual cause on a tablet: they filter module URLs
  // that contain words like "analytics". Say so instead of showing nothing.
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML =
      '<div style="font-family:system-ui;padding:2rem;max-width:40rem">' +
      '<h1 style="font-size:1.25rem">X-Dispatch could not load</h1>' +
      '<p>A browser extension such as an ad or content blocker may have blocked part of the app. ' +
      'Turn it off for this address and reload.</p>' +
      `<pre style="white-space:pre-wrap;opacity:.7">${String((err as Error).message ?? err)}</pre></div>`;
  }
  throw err;
}
