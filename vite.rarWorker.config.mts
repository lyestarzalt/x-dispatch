import path from 'path';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { external } from './vite.base.config.mts';

// The RAR worker thread: one CommonJS file beside main.js, started by path.
export default defineConfig((env) => {
  const { forgeConfigSelf } = env as ConfigEnv<'build'>;
  const config: UserConfig = {
    build: {
      lib: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        entry: forgeConfigSelf.entry!,
        fileName: () => 'rarWorker.js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
      },
      sourcemap: 'hidden',
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  };
  return config;
});
