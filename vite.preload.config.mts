import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
import { external } from './vite.base.config.mts';

// https://vitejs.dev/config
export default defineConfig(() => {
  const config: UserConfig = {
    build: {
      rollupOptions: {
        external,
        output: {
          // Keeps the `preload.js` name main.ts loads.
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
        },
      },
      sourcemap: 'hidden',
    },
    plugins: [
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: { name: `x-dispatch@${pkg.version}` },
        sourcemaps: {
          filesToDeleteAfterUpload: ['.vite/build/**/*.map'],
        },
        telemetry: false,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  };

  return config;
});
