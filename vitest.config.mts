import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    fsModuleCache: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(configDir, 'src'),
    },
  },
});
