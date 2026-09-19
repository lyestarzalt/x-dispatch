import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import pkg from './package.json';
import { pluginExposeRenderer } from './vite.base.config';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
      sourcemap: 'hidden',
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
      // maplibre-gl v6 is ESM-only and loads its worker as a real URL
      // (dist/maplibre-gl-worker.mjs) instead of a blob. Vite's dep
      // pre-bundler rewrites the entry but does not emit that sibling
      // chunk into .vite/deps, so the worker 404s at runtime. Excluding
      // it lets the package resolve its own worker from node_modules.
      exclude: ['maplibre-gl'],
    },
    esbuild: {
      target: 'es2022',
    },
    worker: {
      format: 'es',
    },
    plugins: [
      react(),
      pluginExposeRenderer(name),
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: { name: `x-dispatch@${pkg.version}` },
        sourcemaps: {
          filesToDeleteAfterUpload: [`.vite/renderer/${name}/**/*.map`],
        },
        telemetry: false,
      }),
    ],
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, './assets'),
      },
    },
    clearScreen: false,
  } as UserConfig;
});
