import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { PublisherGithub } from '@electron-forge/publisher-github';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { cp, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

function getPlatformLabel(platform: string, arch: string): string {
  if (platform === 'win32') return `windows-${arch}`;
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-apple-silicon' : 'mac-intel';
  return `linux-${arch}`;
}

const RENAME_EXTENSIONS = new Set(['.exe', '.dmg', '.deb', '.rpm']);

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpackDir: 'node_modules/7zip-bin',
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
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'XDispatch',
      setupIcon: './assets/icon.ico',
      loadingGif: './assets/transparent.gif',
    }),
    new MakerDMG({
      icon: './assets/icon.icns',
      format: 'ULFO',
    }),
    new MakerDeb({
      options: {
        icon: './assets/icon.png',
        categories: ['Utility', 'Game'],
        section: 'utils',
        mimeType: ['x-scheme-handler/xdispatch'],
      },
    }),
    new MakerRpm({
      options: {
        icon: './assets/icon.png',
        categories: ['Utility', 'Game'],
      },
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'lyestarzalt',
        name: 'x-dispatch',
      },
      draft: true,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    async postMake(_forgeConfig, makeResults) {
      const pkg = JSON.parse(require('node:fs').readFileSync('./package.json', 'utf-8'));
      for (const result of makeResults) {
        const label = getPlatformLabel(result.platform, result.arch);
        const renamed: string[] = [];
        for (const artifact of result.artifacts) {
          const ext = path.extname(artifact);
          if (RENAME_EXTENSIONS.has(ext)) {
            const newName = `X-Dispatch-${pkg.version}-${label}${ext}`;
            const newPath = path.join(path.dirname(artifact), newName);
            await rename(artifact, newPath);
            renamed.push(newPath);
          } else {
            renamed.push(artifact);
          }
        }
        result.artifacts = renamed;
      }
      return makeResults;
    },

    async packageAfterCopy(_forgeConfig, buildPath) {
      const requiredPackages = [
        'sql.js',
        'electron-squirrel-startup',
        'ws',
        'bufferutil',
        'utf-8-validate',
        '7zip-bin',
        'node-7z',
      ];

      const sourceNodeModulesPath = path.resolve(__dirname, 'node_modules');
      const destNodeModulesPath = path.resolve(buildPath, 'node_modules');

      await Promise.all(
        requiredPackages.map(async (packageName) => {
          const sourcePath = path.join(sourceNodeModulesPath, packageName);
          const destPath = path.join(destNodeModulesPath, packageName);

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
    },
  },
};

export default config;
