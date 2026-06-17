import { describe, expect, it } from 'vitest';
import { TRANSIENT_NET_ERROR_PATTERN } from './transientNetErrors';

describe('TRANSIENT_NET_ERROR_PATTERN', () => {
  it.each([
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_NETWORK_CHANGED',
    'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_ABORTED',
    'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_TIMED_OUT',
    'net::ERR_ADDRESS_UNREACHABLE',
    'net::ERR_PROXY_CONNECTION_FAILED',
  ])('matches transient code %s', (msg) => {
    expect(TRANSIENT_NET_ERROR_PATTERN.test(msg)).toBe(true);
  });

  it.each([
    'net::ERR_CERT_AUTHORITY_INVALID',
    'net::ERR_CERT_DATE_INVALID',
    'net::ERR_BAD_SSL_CLIENT_AUTH_CERT',
    'net::ERR_HTTP2_PROTOCOL_ERROR',
    'net::ERR_BLOCKED_BY_CLIENT',
    'net::ERR_CONTENT_DECODING_FAILED',
    'net::ERR_TOO_MANY_REDIRECTS',
    'net::ERR_INVALID_URL',
    'net::ERR_UNSAFE_PORT',
  ])('does not match actionable code %s', (msg) => {
    expect(TRANSIENT_NET_ERROR_PATTERN.test(msg)).toBe(false);
  });

  it.each([
    'TypeError: foo is not a function',
    'SqliteError: database is locked',
    'Error: ENOENT: no such file or directory',
    "Cannot read properties of undefined (reading 'getLayer')",
    '',
  ])('does not match non-network error %s', (msg) => {
    expect(TRANSIENT_NET_ERROR_PATTERN.test(msg)).toBe(false);
  });

  it('is anchored — does not match when transient code is a substring', () => {
    expect(
      TRANSIENT_NET_ERROR_PATTERN.test('Wrapper: net::ERR_INTERNET_DISCONNECTED happened')
    ).toBe(false);
    expect(TRANSIENT_NET_ERROR_PATTERN.test('net::ERR_TIMED_OUT_AFTER_RETRY')).toBe(false);
  });
});
