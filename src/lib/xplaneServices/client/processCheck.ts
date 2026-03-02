import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if X-Plane process is actually running (cross-platform).
 * Filters out zombie/dead processes that linger after --version or --help calls.
 */
export async function isXPlaneProcessRunning(): Promise<boolean> {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq X-Plane.exe" /NH');
      return stdout.toLowerCase().includes('x-plane.exe');
    } else if (platform === 'darwin') {
      // Only match S (sleeping/idle) or R (running) — filters out Z (zombie)
      // and UE (stuck exiting) ghost processes from --version/--help calls
      const { stdout } = await execAsync(`ps -axo state,comm | grep 'X-Plane$' | grep '^[SR]'`);
      return stdout.trim().length > 0;
    } else {
      const { stdout } = await execAsync(
        `ps -axo state,comm | grep 'X-Plane-x86_64$' | grep '^[SR]'`
      );
      return stdout.trim().length > 0;
    }
  } catch {
    return false;
  }
}
