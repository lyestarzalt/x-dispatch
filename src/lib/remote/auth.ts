import { timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';

export const TOKEN_COOKIE = 'xd_remote';
const MAX_FAILURES = 10;
const WINDOW_MS = 60_000;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function tokenFromRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', 'http://local');
  const query = url.searchParams.get('token');
  if (query) return query;
  const cookie = req.headers.cookie ?? '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === TOKEN_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export type AuthOutcome = 'ok' | 'unauthorized' | 'rate-limited';

/** Token check with a per-IP failure limit (MAX_FAILURES per minute). */
export class RemoteAuth {
  private failures = new Map<string, number[]>();

  constructor(private getToken: () => string) {}

  check(req: IncomingMessage, now = Date.now()): AuthOutcome {
    const ip = req.socket.remoteAddress ?? 'unknown';
    const recent = (this.failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_FAILURES) {
      this.failures.set(ip, recent);
      return 'rate-limited';
    }
    const token = tokenFromRequest(req);
    const expected = this.getToken();
    if (token && expected && safeEqual(token, expected)) {
      this.failures.delete(ip);
      return 'ok';
    }
    recent.push(now);
    this.failures.set(ip, recent);
    return 'unauthorized';
  }

  cookieHeader(): string {
    return `${TOKEN_COOKIE}=${encodeURIComponent(this.getToken())}; Path=/; HttpOnly; SameSite=Lax`;
  }
}
