/**
 * Electron's `net.fetch` / `net.request` surface Chromium's network error codes
 * verbatim as `net::ERR_<NAME>` in the Error message. This pattern matches the
 * subset that represent environmental failures (user offline, DNS hiccup, wifi
 * switch, blocked proxy) rather than actionable bugs.
 *
 * Used by Sentry's `ignoreErrors` to suppress noise from main-process callers
 * (tile cache, AVWX, simbrief, etc.) when the user simply lost connectivity.
 *
 * Deliberately NOT matched (still reaches Sentry):
 *   - net::ERR_CERT_*           — cert chain / pinning issues, possible MITM
 *   - net::ERR_BAD_SSL_*        — TLS handshake bugs
 *   - net::ERR_HTTP2_*          — protocol bugs
 *   - net::ERR_BLOCKED_BY_*     — ad-blocker / extension interference
 *   - net::ERR_CONTENT_DECODING_FAILED — likely a real origin/parser bug
 *
 * Codes from Chromium `net/base/net_error_list.h`.
 */
export const TRANSIENT_NET_ERROR_PATTERN =
  /^net::ERR_(INTERNET_DISCONNECTED|NETWORK_CHANGED|NAME_NOT_RESOLVED|CONNECTION_(REFUSED|RESET|ABORTED|TIMED_OUT)|TIMED_OUT|ADDRESS_UNREACHABLE|PROXY_CONNECTION_FAILED)$/;
