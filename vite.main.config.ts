import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vite';
import pkg from './package.json';
import { external, getBuildConfig, getBuildDefine, pluginHotRestart } from './vite.base.config';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'build'>;
  const { forgeConfigSelf } = forgeEnv;
  const define = getBuildDefine(forgeEnv);
  const config: UserConfig = {
    build: {
      lib: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        entry: forgeConfigSelf.entry!,
        fileName: () => '[name].js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
      },
      sourcemap: true,
    },
    plugins: [
      pluginHotRestart('restart'),
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: { name: `x-dispatch@${pkg.version}` },
      }),
    ],
    define,
    resolve: {
      // Load the Node.js entry.
      mainFields: ['module', 'jsnext:main', 'jsnext'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };

  return mergeConfig(getBuildConfig(forgeEnv), config);
});
