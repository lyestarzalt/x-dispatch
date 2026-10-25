/**
 * The message of whatever was thrown, with its causes. Node's `fetch` and
 * `fs` wrap the real reason in `cause` ("fetch failed" over "ECONNRESET:
 * socket hang up"), and `String(err)` or `err.message` alone drop it, which
 * is how a log line ends up saying nothing. Pure, so it runs in the main
 * process, the renderer and workers alike.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = 'cause' in err && err.cause !== undefined ? causeMessage(err.cause) : null;
    return cause ? `${err.message} (${cause})` : err.message;
  }
  return String(err);
}

function causeMessage(cause: unknown): string | null {
  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code;
    const text = errorMessage(cause);
    return typeof code === 'string' && !text.startsWith(code) ? `${code}: ${text}` : text;
  }
  if (cause && typeof cause === 'object') {
    const { code, message } = cause as { code?: unknown; message?: unknown };
    if (typeof message === 'string' && typeof code === 'string') return `${code}: ${message}`;
    if (typeof message === 'string') return message;
    if (typeof code === 'string') return code;
    return null;
  }
  return cause === null || cause === undefined ? null : String(cause);
}
