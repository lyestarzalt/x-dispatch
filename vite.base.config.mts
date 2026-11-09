// Modules the main and preload bundles load from node_modules at runtime.
// Electron and the Node.js built-ins are already external through
// @electron-forge/plugin-vite, which also supplies the base build config,
// the renderer defines and hot restart, then merges each config here on top.
export const external = [
  // ws, bufferutil, utf-8-validate: WebSocket with native C++ bindings
  'ws',
  'bufferutil',
  'utf-8-validate',
  'electron-squirrel-startup',
  '7zip-bin',
  'node-7z',
  // Loaded by its CommonJS entry: the ESM one is the browser build, without file support
  'node-unrar-js',
  'velopack',
  // Event loop block detection: spawns a worker from a file next to its own
  // module and loads a native add-on built for Electron at package time.
  '@sentry/node-native',
  '@sentry/node-native-stacktrace',
];
