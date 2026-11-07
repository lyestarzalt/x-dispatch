import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
import { external } from './vite.base.config.mts';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const { forgeConfigSelf } = env as ConfigEnv<'build'>;
  const config: UserConfig = {
    build: {
      lib: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        entry: forgeConfigSelf.entry!,
        // Keeps the `.js` name that package.json `main` points at.
        fileName: () => '[name].js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
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
