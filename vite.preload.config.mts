import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import type { ConfigEnv, Plugin, UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
import { external, getBuildConfig, pluginHotRestart } from './vite.base.config.mts';

// @electron-forge/plugin-vite merges `inlineDynamicImports: true` into the
// preload output; rolldown deprecated that option in favor of
// `codeSplitting: false`, so swap it after the merge to keep the single-file
// output without the startup warning.
function pluginSingleChunkOutput(): Plugin {
  return {
    name: 'x-dispatch:single-chunk-output',
    config(config) {
      const output = config.build?.rollupOptions?.output;
      for (const o of Array.isArray(output) ? output : output ? [output] : []) {
        delete (o as Record<string, unknown>).inlineDynamicImports;
        (o as Record<string, unknown>).codeSplitting = false;
      }
    },
  };
}

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
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
      sourcemap: 'hidden',
    },
    plugins: [
      pluginSingleChunkOutput(),
      pluginHotRestart('reload'),
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

  return mergeConfig(getBuildConfig(forgeEnv), config);
});
