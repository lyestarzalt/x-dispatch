import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLog } from './parseLog';

const fixture = readFileSync(resolve(__dirname, '__fixtures__/success-log-snippet.txt'), 'utf8');

describe('parseLog', () => {
  it('collects pre-runtime lines into header and runtime lines into entries', () => {
    const result = parseLog(fixture);
    expect(result.header.length).toBeGreaterThan(0);
    expect(result.header[0]).toContain('Log.txt for X-Plane');
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('parses info/warn/error levels correctly', () => {
    const text = '0:00:00.000 I/GFX: info\n0:00:00.001 W/APT: warn\n0:00:00.002 E/NET: error\n';
    const result = parseLog(text);
    expect(result.entries.map((e) => e.level)).toEqual(['info', 'warn', 'error']);
  });

  it('uses top-level category when nested (W/GFX/MTL)', () => {
    const result = parseLog('0:00:00.000 W/GFX/MTL: shader warning\n');
    expect(result.entries[0]?.category).toBe('GFX');
    expect(result.entries[0]?.raw).toBe('0:00:00.000 W/GFX/MTL: shader warning');
  });

  it('extracts timestamp, category, and message', () => {
    const result = parseLog("0:00:06.355 I/FLT: Init dat_p0 type:'ramp_start' apt:DAAG\n");
    const entry = result.entries[0];
    expect(entry?.timestamp).toBe('0:00:06.355');
    expect(entry?.category).toBe('FLT');
    expect(entry?.message).toContain("type:'ramp_start'");
  });

  it('reports lineCount equal to input lines', () => {
    expect(parseLog('a\nb\nc').lineCount).toBe(3);
  });

  it('handles empty input', () => {
    expect(parseLog('')).toEqual({ header: [], entries: [], lineCount: 1 });
  });

  it('preserves lineNumber relative to the input', () => {
    const text = 'header line\n\n0:00:00.000 I/GFX: hello\n';
    const result = parseLog(text);
    expect(result.entries[0]?.lineNumber).toBe(3);
  });
});
