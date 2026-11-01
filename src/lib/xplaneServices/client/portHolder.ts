import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PortHolder {
  pid: number;
  /** Process image name as the OS reports it, for example `Kaspersky.exe` or `X-Plane`. */
  name: string;
  /** The holder is an X-Plane binary: a leftover instance, or the live one refusing traffic. */
  isXPlane: boolean;
}

export function isXPlaneProcessName(name: string): boolean {
  return /^x-plane(\.exe|-x86_64)?$/i.test(name.trim());
}

/** PID of the TCP listener on `port` in `netstat -ano -p tcp` output, IPv4 or IPv6. */
export function parseNetstatListener(stdout: string, port: number): number | null {
  for (const line of stdout.split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || cols[0] !== 'TCP' || cols[3] !== 'LISTENING') continue;
    if (!cols[1]!.endsWith(`:${port}`)) continue;
    const pid = Number(cols[4]);
    if (Number.isInteger(pid) && pid > 0) return pid;
  }
  return null;
}

/** Image name from `tasklist /FO CSV /NH`; null for the "no tasks" notice. */
export function parseTasklistName(stdout: string): string | null {
  const match = stdout.match(/^"([^"]+)"/m);
  return match ? match[1]! : null;
}

/** First listener from `lsof -nP -iTCP:<port> -sTCP:LISTEN`, whose columns start COMMAND PID. */
export function parseLsofListener(stdout: string): { pid: number; name: string } | null {
  for (const line of stdout.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 2) continue;
    const pid = Number(cols[1]);
    if (Number.isInteger(pid) && pid > 0) return { pid, name: cols[0]! };
  }
  return null;
}

/**
 * Who is listening on `port` right now, or null when nobody is or the lookup
 * failed. Only worth calling on the launch error path: it shells out twice on
 * Windows.
 */
export async function findPortHolder(port: number): Promise<PortHolder | null> {
  try {
    let holder: { pid: number; name: string } | null;
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('netstat -ano -p tcp');
      const pid = parseNetstatListener(stdout, port);
      if (pid === null) return null;
      const { stdout: tasks } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
      const name = parseTasklistName(tasks);
      holder = name ? { pid, name } : null;
    } else {
      // +c 0 stops lsof truncating command names at nine characters.
      const { stdout } = await execAsync(`lsof +c 0 -nP -iTCP:${port} -sTCP:LISTEN`);
      holder = parseLsofListener(stdout);
    }
    return holder ? { ...holder, isXPlane: isXPlaneProcessName(holder.name) } : null;
  } catch {
    return null;
  }
}
