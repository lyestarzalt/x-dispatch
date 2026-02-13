import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if X-Plane process is running (cross-platform)
 */
export async function isXPlaneProcessRunning(): Promise<boolean> {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq X-Plane.exe" /NH');
      return stdout.toLowerCase().includes('x-plane.exe');
    } else if (platform === 'darwin') {
      const { stdout } = await execAsync('pgrep -x "X-Plane"');
      return stdout.trim().length > 0;
    } else {
      const { stdout } = await execAsync('pgrep -x "X-Plane-x86_64"');
      return stdout.trim().length > 0;
    }
  } catch {
    return false;
  }
}
