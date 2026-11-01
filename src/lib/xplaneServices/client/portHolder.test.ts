import { describe, expect, it } from 'vitest';
import {
  isXPlaneProcessName,
  parseLsofListener,
  parseNetstatListener,
  parseTasklistName,
} from './portHolder';

const NETSTAT = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:8086         0.0.0.0:0              LISTENING       2040
  TCP    127.0.0.1:80860        0.0.0.0:0              LISTENING       9999
  TCP    127.0.0.1:52000        127.0.0.1:8086         ESTABLISHED     7777
  TCP    [::]:8086              [::]:0                 LISTENING       3932
`;

describe('parseNetstatListener', () => {
  it('returns the PID of the IPv4 listener on the port', () => {
    expect(parseNetstatListener(NETSTAT, 8086)).toBe(2040);
  });

  it('ignores connections to the port and ports that merely start with the digits', () => {
    expect(parseNetstatListener(NETSTAT, 80860)).toBe(9999);
    expect(parseNetstatListener(NETSTAT, 52000)).toBeNull();
    expect(parseNetstatListener(NETSTAT, 8087)).toBeNull();
  });

  it('finds an IPv6-only wildcard listener', () => {
    const v6 = NETSTAT.split('\n')
      .filter((l) => !l.includes('127.0.0.1:8086 '))
      .join('\n');
    expect(parseNetstatListener(v6, 8086)).toBe(3932);
  });
});

describe('parseTasklistName', () => {
  it('reads the image name from CSV output', () => {
    expect(parseTasklistName('"Kaspersky.exe","4321","Console","1","12,345 K"\r\n')).toBe(
      'Kaspersky.exe'
    );
  });

  it('returns null for the no-tasks notice', () => {
    expect(
      parseTasklistName('INFO: No tasks are running which match the specified criteria.\r\n')
    ).toBeNull();
  });
});

describe('parseLsofListener', () => {
  it('reads command and PID, skipping the header', () => {
    const out =
      'COMMAND    PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n' +
      'X-Plane-x86_64 4242 lyes   33u  IPv4 0x1 0t0 TCP 127.0.0.1:8086 (LISTEN)\n';
    expect(parseLsofListener(out)).toEqual({ pid: 4242, name: 'X-Plane-x86_64' });
  });

  it('returns null for empty output', () => {
    expect(parseLsofListener('')).toBeNull();
  });
});

describe('isXPlaneProcessName', () => {
  it('matches the three platform binaries, case-insensitively', () => {
    expect(isXPlaneProcessName('X-Plane.exe')).toBe(true);
    expect(isXPlaneProcessName('x-plane.exe')).toBe(true);
    expect(isXPlaneProcessName('X-Plane')).toBe(true);
    expect(isXPlaneProcessName('X-Plane-x86_64')).toBe(true);
  });

  it('does not match installers or other programs', () => {
    expect(isXPlaneProcessName('X-Plane 12 Installer.exe')).toBe(false);
    expect(isXPlaneProcessName('python.exe')).toBe(false);
  });
});
