import { app, screen } from 'electron';
import os from 'os';
import logger, { getLogPath } from './logger';

export function logStartupEnvironment(shouldInitSentry: boolean): void {
  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];

  logger.main.info('════════════════════════════════════════════════════════════════');
  logger.main.info(`X-Dispatch v${app.getVersion()} starting`);
  logger.main.info('════════════════════════════════════════════════════════════════');

  // OS & hardware
  logger.main.info(`OS: ${os.platform()} ${os.release()} (${os.arch()})`);
  logger.main.info(
    `System: ${os.cpus()[0]?.model || 'Unknown CPU'}, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`
  );
  logger.main.info(
    `Electron: ${process.versions.electron}, Chrome: ${process.versions.chrome}, Node: ${process.versions.node}`
  );

  // GPU: basic info (vendor, device, driver) — async, logged when ready.
  // The payload is `{ auxAttributes, gpuDevice: [...] }`; there is no
  // `gpu.devices` path, which is why this used to log nothing at all.
  app
    .getGPUInfo('basic')
    .then((gpu) => {
      const g = gpu as {
        gpuDevice?: Array<{
          vendorId: number;
          deviceId: number;
          deviceString?: string;
          driverVersion?: string;
          active?: boolean;
        }>;
      };
      for (const dev of g.gpuDevice ?? []) {
        logger.main.info(
          `GPU: ${dev.deviceString ?? 'unknown'} vendor=0x${dev.vendorId.toString(16)} device=0x${dev.deviceId.toString(16)} driver=${dev.driverVersion ?? 'unknown'}${dev.active ? ' (active)' : ''}`
        );
      }
    })
    .catch(() => logger.main.warn('GPU: failed to query gpu info'));

  // GPU feature status (hardware acceleration state).
  // Must wait for `gpu-info-update`: while the GPU process is still
  // handshaking, `getGPUFeatureStatus()` reports everything as
  // disabled_software / disabled_off no matter what the hardware does, so
  // reading it on `ready` logged a permanent false "no GPU". There is also
  // no `webgl2` key in the status object — `webgl: enabled` covers WebGL2.
  app.once('gpu-info-update', () => {
    const f = app.getGPUFeatureStatus();
    logger.main.info(
      `GPU compositing: ${f.gpu_compositing}, webgl: ${f.webgl}, rasterization: ${f.rasterization}, video decode: ${f.video_decode}`
    );
  });

  // Per-display details
  for (const [i, display] of displays.entries()) {
    const label = display.id === primaryDisplay?.id ? 'primary' : 'secondary';
    logger.main.info(
      `Display ${i + 1} (${label}): ${display.size.width}x${display.size.height}, scale=${display.scaleFactor}, rotation=${display.rotation}, colorDepth=${display.colorDepth}`
    );
  }

  // Misc
  logger.main.info(`Locale: ${app.getLocale()}`);
  logger.main.info(`Paths: userData=${app.getPath('userData')}`);
  logger.main.debug(`Log file: ${getLogPath()}`);

  // Crash reporting
  logger.main.info(`Crash reporting: ${shouldInitSentry ? 'enabled' : 'disabled'}`);
}
