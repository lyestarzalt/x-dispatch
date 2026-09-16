/**
 * Electron's `net.fetch` / `net.request` surface Chromium's network error codes
 * verbatim as `net::ERR_<NAME>` in the Error message. This pattern matches the
 * subset that represent environmental failures (user offline, DNS hiccup, wifi
 * switch, blocked proxy) rather than actionable bugs.
 *
 * Used by Sentry's `ignoreErrors` to suppress noise from main-process callers
 * (tile cache, AVWX, simbrief, etc.) when the user simply lost connectivity.
 *
 * QUIC is matched even though HTTP/2 is not: QUIC rides on UDP, which
 * middleboxes, corporate firewalls and VPNs routinely mangle or block outright.
 * Chromium retries the request over TCP on its own, so these describe a
 * degraded network path rather than a defect at the origin. Left unmatched they
 * dominate the issue stream — the tile CDN alone produced ~14.8k
 * ERR_QUIC_PROTOCOL_ERROR events, every one of them already handled and
 * recovered from.
 *
 * Deliberately NOT matched (still reaches Sentry):
 *   - net::ERR_CERT_*           — cert chain / pinning issues, possible MITM
 *   - net::ERR_BAD_SSL_*        — TLS handshake bugs
 *   - net::ERR_HTTP2_*          — protocol bugs over a connection that worked
 *   - net::ERR_BLOCKED_BY_*     — ad-blocker / extension interference
 *   - net::ERR_CONTENT_DECODING_FAILED — likely a real origin/parser bug
 *
 * Codes from Chromium `net/base/net_error_list.h`.
 */
export const TRANSIENT_NET_ERROR_PATTERN =
  /^net::ERR_(INTERNET_DISCONNECTED|NETWORK_CHANGED|NAME_NOT_RESOLVED|CONNECTION_(REFUSED|RESET|ABORTED|TIMED_OUT)|TIMED_OUT|ADDRESS_UNREACHABLE|PROXY_CONNECTION_FAILED|QUIC_(PROTOCOL_ERROR|HANDSHAKE_FAILED))$/;
