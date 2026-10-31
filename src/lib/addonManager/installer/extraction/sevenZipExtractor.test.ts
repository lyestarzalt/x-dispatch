import { describe, expect, it } from 'vitest';
import { sevenZipErrorCode } from './sevenZipExtractor';

describe('sevenZipErrorCode', () => {
  it('reads the password failure from stderr when node-7z gives no message', () => {
    const failure = {
      message: 'unknown error',
      stderr: 'ERROR: Wrong password? : Plane/plane.acf',
    };
    expect(sevenZipErrorCode(failure, '/a.7z', undefined)).toEqual({
      code: 'PASSWORD_REQUIRED',
      path: '/a.7z',
    });
    expect(sevenZipErrorCode(failure, '/a.7z', 'nope')).toEqual({
      code: 'INVALID_PASSWORD',
      path: '/a.7z',
    });
  });

  it('spots a header-encrypted archive', () => {
    const failure = { message: 'Can not open encrypted archive. Wrong password?' };
    expect(sevenZipErrorCode(failure, '/a.7z', undefined).code).toBe('PASSWORD_REQUIRED');
  });

  it('keeps anything else as an extraction failure with the text', () => {
    expect(
      sevenZipErrorCode(
        { message: 'unknown error', stderr: 'ERROR: Data Error' },
        '/a.7z',
        undefined
      )
    ).toEqual({
      code: 'EXTRACTION_FAILED',
      path: '/a.7z',
      reason: 'unknown error ERROR: Data Error',
    });
    expect(sevenZipErrorCode({}, '/a.7z', undefined)).toMatchObject({ reason: 'unknown error' });
  });
});
