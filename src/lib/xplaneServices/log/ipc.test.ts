import { describe, expect, it, vi } from 'vitest';
import { readXPlaneLog } from './ipc';

vi.mock('@/lib/utils/logger', () => ({
  default: { main: { warn: vi.fn(), info: vi.fn() } },
}));

const statMock = vi.fn();
const readFileMock = vi.fn();
const createReadStreamMock = vi.fn();
vi.mock('node:fs/promises', () => ({
  stat: (...args: unknown[]) => statMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
}));
vi.mock('node:fs', () => ({
  createReadStream: (...args: unknown[]) => createReadStreamMock(...args),
}));

describe('readXPlaneLog', () => {
  it('returns no-path when xplanePath is null', async () => {
    const result = await readXPlaneLog(null);
    expect(result).toEqual({ kind: 'no-path' });
  });

  it('returns no-log when Log.txt does not exist', async () => {
    statMock.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'ENOENT' }));
    const result = await readXPlaneLog('/x');
    expect(result).toEqual({ kind: 'no-log' });
  });

  it('returns ok untruncated for a small file', async () => {
    statMock.mockResolvedValueOnce({ size: 1234 });
    readFileMock.mockResolvedValueOnce('hello world');
    const result = await readXPlaneLog('/x');
    expect(result).toEqual({
      kind: 'ok',
      data: 'hello world',
      fullByteSize: 1234,
      truncated: false,
    });
  });

  it('truncates large files to last 5MB and drops the partial first line', async () => {
    statMock.mockResolvedValueOnce({ size: 10_000_000 });
    const chunks = ['partial line at start\nfull line\nanother line\n'];
    createReadStreamMock.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function* () {
        for (const c of chunks) yield Buffer.from(c, 'utf8');
      },
    });
    const result = await readXPlaneLog('/x');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.truncated).toBe(true);
    expect(result.fullByteSize).toBe(10_000_000);
    expect(result.data.startsWith('full line')).toBe(true);
    expect(result.data).not.toContain('partial line at start');
  });

  it('returns error when the read fails', async () => {
    statMock.mockResolvedValueOnce({ size: 100 });
    readFileMock.mockRejectedValueOnce(new Error('EACCES'));
    const result = await readXPlaneLog('/x');
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') throw new Error('unreachable');
    expect(result.message).toContain('EACCES');
  });
});
