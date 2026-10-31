import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { collectPackageDependencies } from './src/lib/build/packageDependencies';
import { buildThirdPartyLicenses } from './src/lib/build/thirdPartyLicenses';
import { macDocumentTypesInfo } from './src/lib/nativeShell/fileAssociations';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpackDir: 'node_modules/7zip-bin',
      // Native modules cannot load from inside the archive.
      unpack: '**/*.node',
    },
    icon: './assets/icon',
    executableName: 'x-dispatch',
    extraResource: ['./assets'],
    protocols: [
      {
        name: 'X-Dispatch',
        schemes: ['xdispatch'],
      },
    ],
    // .fms flight plans show X-Dispatch under Open With; Windows registers per user at launch.
    extendInfo: macDocumentTypesInfo(),
  },
  rebuildConfig: {},
  // Installers and update packages come from Velopack (scripts/pack-velopack.sh).
  makers: [],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      // Off while the Mac app is signed ad hoc: every update has a new code identity, so the
      // cookie key in the keychain prompts again each time. Turn back on with a Developer ID.
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      // Production builds disable --inspect for security. E2E builds keep it
      // enabled because Playwright's electron driver needs it to attach for
      // automation. Set E2E_BUILD=1 when packaging for tests.
      [FuseV1Options.EnableNodeCliInspectArguments]: process.env.E2E_BUILD === '1',
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    async packageAfterCopy(_forgeConfig, buildPath) {
      // Modules Vite leaves external, with everything they require at runtime
      const requiredPackages = [
        'electron-squirrel-startup',
        'ws',
        'bufferutil',
        'utf-8-validate',
        '7zip-bin',
        'node-7z',
        'node-unrar-js',
        'velopack',
        '@neon-rs/load',
      ];

      const sourceNodeModulesPath = path.resolve(__dirname, 'node_modules');
      const destNodeModulesPath = path.resolve(buildPath, 'node_modules');
      const packageDirs = collectPackageDependencies(sourceNodeModulesPath, requiredPackages);

      await Promise.all(
        packageDirs.map(async (packageDir) => {
          const sourcePath = path.join(sourceNodeModulesPath, packageDir);
          const destPath = path.join(destNodeModulesPath, packageDir);

          await mkdir(path.dirname(destPath), { recursive: true });
          await cp(sourcePath, destPath, {
            recursive: true,
            preserveTimestamps: true,
          });
        })
      );

      // Copy drizzle migrations folder
      const sourceDrizzlePath = path.resolve(__dirname, 'drizzle');
      const destDrizzlePath = path.resolve(buildPath, 'drizzle');
      await cp(sourceDrizzlePath, destDrizzlePath, {
        recursive: true,
        preserveTimestamps: true,
      });

      await writeFile(
        path.resolve(buildPath, 'THIRD_PARTY_LICENSES.txt'),
        buildThirdPartyLicenses(__dirname)
      );
    },
  },
};

export default config;
