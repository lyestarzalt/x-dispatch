import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
import { CONTENT_SECURITY_POLICY, CSP_META_PLACEHOLDER } from './src/config/csp';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const { forgeConfigSelf } = env as ConfigEnv<'renderer'>;
  const name = forgeConfigSelf.name ?? '';

  return {
    build: {
      sourcemap: 'hidden',
      target: 'es2022',
    },
    optimizeDeps: {
      // maplibre-gl v6 is ESM-only and loads its worker as a real URL
      // (dist/maplibre-gl-worker.mjs) instead of a blob. Vite's dep
      // pre-bundler rewrites the entry but does not emit that sibling
      // chunk into .vite/deps, so the worker 404s at runtime. Excluding
      // it lets the package resolve its own worker from node_modules.
      exclude: ['maplibre-gl'],
    },
    worker: {
      format: 'es',
    },
    plugins: [
      react(),
      {
        name: 'x-dispatch-csp',
        transformIndexHtml: (html: string) =>
          html.replace(CSP_META_PLACEHOLDER, CONTENT_SECURITY_POLICY),
      },
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
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@assets': path.resolve(import.meta.dirname, './assets'),
      },
    },
  } as UserConfig;
});
