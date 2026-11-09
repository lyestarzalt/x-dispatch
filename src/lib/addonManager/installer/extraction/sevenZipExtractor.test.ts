import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { collectSevenZipStderr, sevenZipErrorCode, unpackedBinaryPath } from './sevenZipExtractor';

describe('collectSevenZipStderr', () => {
  it('keeps every chunk, so a password failure survives a split stderr', () => {
    // `7z l` writes a blank line first; when the OS delivers it as its own chunk,
    // node-7z keeps that chunk and drops the one with the error (first chunk wins).
    const stderr = new EventEmitter();
    const stream = { _childProcess: { stderr } };
    const text = collectSevenZipStderr(stream);
    stderr.emit('data', Buffer.from('\n'));
    stderr.emit(
      'data',
      Buffer.from('ERROR: Hidden.7z : Can not open encrypted archive. Wrong password?\n')
    );
    expect(text()).toContain('Wrong password?');
    expect(
      sevenZipErrorCode({ message: 'unknown error', stderr: text() }, '/a.7z', undefined)
    ).toEqual({
      code: 'PASSWORD_REQUIRED',
      path: '/a.7z',
    });
  });

  it('reads nothing from a stream without a child process', () => {
    expect(collectSevenZipStderr({})()).toBe('');
  });
});

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

describe('unpackedBinaryPath', () => {
  it('points a packaged binary at the unpacked copy', () => {
    expect(
      unpackedBinaryPath(
        'C:\\Users\\me\\AppData\\Local\\XDispatch\\current\\resources\\app.asar\\node_modules\\7zip-bin\\win\\x64\\7za.exe'
      )
    ).toBe(
      'C:\\Users\\me\\AppData\\Local\\XDispatch\\current\\resources\\app.asar.unpacked\\node_modules\\7zip-bin\\win\\x64\\7za.exe'
    );
    expect(
      unpackedBinaryPath('/opt/X-Dispatch/resources/app.asar/node_modules/7zip-bin/linux/x64/7za')
    ).toBe('/opt/X-Dispatch/resources/app.asar.unpacked/node_modules/7zip-bin/linux/x64/7za');
  });

  it('leaves a development path alone', () => {
    expect(unpackedBinaryPath('/repo/node_modules/7zip-bin/mac/arm64/7za')).toBe(
      '/repo/node_modules/7zip-bin/mac/arm64/7za'
    );
  });
});
