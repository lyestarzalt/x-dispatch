import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vite';
import pkg from './package.json';
import { external, getBuildConfig, pluginHotRestart } from './vite.base.config';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'build'>;
  const { forgeConfigSelf } = forgeEnv;
  const config: UserConfig = {
    build: {
      rollupOptions: {
        external,
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        input: forgeConfigSelf.entry!,
        output: {
          format: 'cjs',
          // It should not be split chunks.
          inlineDynamicImports: true,
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
      sourcemap: true,
    },
    plugins: [
      pluginHotRestart('reload'),
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: { name: `x-dispatch@${pkg.version}` },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };

  return mergeConfig(getBuildConfig(forgeEnv), config);
});
