import { describe, expect, it } from 'vitest';
import { qrPath } from './QrCode';

describe('qrPath', () => {
  it('produces a square module grid with the finder patterns drawn', () => {
    const { path, size } = qrPath('http://192.168.1.10:8480/?token=abc');
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith('M0 0h1v1h-1z')).toBe(true);
    expect(path).toContain(`M${size - 1} 0h1v1h-1z`);
  });
});
