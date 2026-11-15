/**
 * Installing an airport from the X-Plane Scenery Gateway as a custom scenery pack.
 * The Gateway's scenery record carries the pack as a base64 zip; it goes through
 * the regular installer and lands in a folder of our own naming, with a marker
 * that remembers which Gateway submission it is, for the update check later.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import { InstallerManager } from '../installer/InstallerManager';
import { SceneryManager } from '../scenery/SceneryManager';
import { packForAirport } from '../scenery/conflicts';

export const GATEWAY_MARKER_FILE = 'x-dispatch-gateway.json';

export interface GatewayMarker {
  sceneryId: number;
  icao: string;
  installedAt: string;
}

export type GatewayError =
  | { code: 'INVALID_INPUT'; field: string }
  | { code: 'DOWNLOAD_FAILED'; reason: string }
  | { code: 'BAD_PACKAGE'; reason: string }
  /** Another custom pack already declares this airport; `pack` is its folder. */
  | { code: 'CONFLICT'; pack: string }
  | { code: 'INSTALL_FAILED'; reason: string }
  | { code: 'NOT_INSTALLED'; icao: string };

export interface GatewayDeps {
  xplanePath: string;
  /** The Gateway's scenery record, fetched by the main process with its timeout. */
  fetchScenery: (sceneryId: number) => Promise<{ data: string | null; error: string | null }>;
}

const ICAO = /^[A-Z0-9]{3,4}$/;

/** The folder a Gateway airport installs into: ours to name, so it is ours to update. */
export function gatewayFolderName(icao: string): string {
  return `Gateway_${icao.toUpperCase()}`;
}

/** The marker of the Gateway pack installed for an airport, or null when there is none. */
export async function readGatewayMarker(
  xplanePath: string,
  icao: string
): Promise<GatewayMarker | null> {
  const upper = icao.toUpperCase();
  if (!ICAO.test(upper)) return null;
  const file = path.join(
    xplanePath,
    'Custom Scenery',
    gatewayFolderName(upper),
    GATEWAY_MARKER_FILE
  );
  try {
    const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8')) as Partial<GatewayMarker>;
    if (typeof parsed.sceneryId !== 'number' || parsed.icao !== upper) return null;
    return {
      sceneryId: parsed.sceneryId,
      icao: upper,
      installedAt: String(parsed.installedAt ?? ''),
    };
  } catch {
    return null;
  }
}

/** The zip inside a Gateway scenery record. */
export function decodeGatewayPackage(json: string): Result<Buffer, GatewayError> {
  let blob: unknown;
  try {
    const parsed = JSON.parse(json) as { scenery?: { masterZipBlob?: unknown } };
    blob = parsed.scenery?.masterZipBlob;
  } catch (e) {
    return err({ code: 'BAD_PACKAGE', reason: `not JSON: ${String(e)}` });
  }
  if (typeof blob !== 'string' || blob.length === 0) {
    return err({ code: 'BAD_PACKAGE', reason: 'no masterZipBlob in the scenery record' });
  }
  const bytes = Buffer.from(blob, 'base64');
  // A zip starts with "PK"; anything else is not the pack we were promised.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return err({ code: 'BAD_PACKAGE', reason: 'masterZipBlob is not a zip' });
  }
  return ok(bytes);
}

/**
 * Download and install one Gateway submission for an airport. A custom pack that
 * already declares the airport stops the install unless `force` is set; our own
 * earlier Gateway pack for the airport is replaced with a clean install.
 */
export async function installGatewayScenery(
  deps: GatewayDeps,
  request: { icao: string; sceneryId: number; force?: boolean }
): Promise<Result<{ folderName: string }, GatewayError>> {
  const icao = request.icao.toUpperCase();
  if (!ICAO.test(icao)) return err({ code: 'INVALID_INPUT', field: 'icao' });
  if (!Number.isInteger(request.sceneryId) || request.sceneryId <= 0) {
    return err({ code: 'INVALID_INPUT', field: 'sceneryId' });
  }
  const folderName = gatewayFolderName(icao);

  if (!request.force) {
    const scenery = await new SceneryManager(deps.xplanePath).analyze();
    if (scenery.ok) {
      const others = scenery.value.filter((entry) => entry.folderName !== folderName);
      const covering = packForAirport(others, icao);
      if (covering?.winner) return err({ code: 'CONFLICT', pack: covering.winner });
    }
  }

  const started = Date.now();
  const fetched = await deps.fetchScenery(request.sceneryId);
  if (fetched.error || !fetched.data) {
    return err({ code: 'DOWNLOAD_FAILED', reason: fetched.error ?? 'empty answer' });
  }
  const decoded = decodeGatewayPackage(fetched.data);
  if (!decoded.ok) return decoded;
  logger.addon.info(
    `Gateway ${icao} scenery ${request.sceneryId}: ${decoded.value.length} bytes in ${Date.now() - started} ms`
  );

  const scratch = path.join(os.tmpdir(), `xdispatch_gateway_${crypto.randomUUID()}`);
  const zipPath = path.join(scratch, `${folderName}.zip`);
  try {
    await fs.promises.mkdir(scratch, { recursive: true });
    await fs.promises.writeFile(zipPath, decoded.value);

    const installer = new InstallerManager(deps.xplanePath);
    const analyzed = await installer.analyze([zipPath]);
    if (!analyzed.ok) return err({ code: 'BAD_PACKAGE', reason: analyzed.error.code });
    const item = analyzed.value.find((candidate) => candidate.addonType === 'Scenery');
    if (!item) return err({ code: 'BAD_PACKAGE', reason: 'no scenery in the Gateway zip' });

    const [task] = installer.prepareInstallTasks([item]);
    if (!task) return err({ code: 'BAD_PACKAGE', reason: 'no install task' });
    task.targetPath = path.join(deps.xplanePath, 'Custom Scenery', folderName);
    task.displayName = folderName;
    task.conflictExists = fs.existsSync(task.targetPath);
    task.installMode = task.conflictExists ? 'clean' : 'fresh';

    const installed = await installer.install([task]);
    if (!installed.ok) return err({ code: 'INSTALL_FAILED', reason: installed.error.code });
    const result = installed.value[0];
    if (!result?.success) {
      return err({
        code: 'INSTALL_FAILED',
        reason: result?.errorCode ?? result?.error ?? 'unknown',
      });
    }

    const marker: GatewayMarker = {
      sceneryId: request.sceneryId,
      icao,
      installedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(
      path.join(task.targetPath, GATEWAY_MARKER_FILE),
      JSON.stringify(marker, null, 2)
    );
    return ok({ folderName });
  } catch (e) {
    logger.addon.warn(`Gateway install of ${icao} failed`, e);
    return err({ code: 'INSTALL_FAILED', reason: String(e) });
  } finally {
    await fs.promises.rm(scratch, { recursive: true, force: true }).catch(() => {});
  }
}

/** Remove the Gateway pack installed for an airport, folder and ini line. */
export async function removeGatewayScenery(
  xplanePath: string,
  icao: string
): Promise<Result<void, GatewayError>> {
  const upper = icao.toUpperCase();
  if (!ICAO.test(upper)) return err({ code: 'INVALID_INPUT', field: 'icao' });
  const folderName = gatewayFolderName(upper);
  if (!(await readGatewayMarker(xplanePath, upper)))
    return err({ code: 'NOT_INSTALLED', icao: upper });
  const removed = await new SceneryManager(xplanePath).deleteScenery(folderName);
  if (!removed.ok) {
    if (removed.error.code === 'FOLDER_NOT_FOUND') {
      // Not in the ini yet (X-Plane has not run since the install): the folder still goes.
      await fs.promises.rm(path.join(xplanePath, 'Custom Scenery', folderName), {
        recursive: true,
        force: true,
      });
      return ok(undefined);
    }
    return err({ code: 'INSTALL_FAILED', reason: removed.error.code });
  }
  return ok(undefined);
}
