import { describe, expect, it } from 'vitest';
import { analyzeLog, scrubPaths } from './logAnalysis';

const HEADER = [
  'Log.txt for X-Plane 12.4.3-r2-15ff1e4d (compiled on Oct 10 2026 10:00:00)',
  'Windows 10.0 (build 26200)',
  'CPU type: 8664',
  'Vulkan Device: NVIDIA GeForce RTX 4070',
  'Vulkan Driver: 32.0.15.6094',
  '',
];

describe('analyzeLog', () => {
  it('reads the version, GPU and driver, and sees a clean shutdown', () => {
    const log = [
      ...HEADER,
      '0:00:01.000 I/SYS: hello',
      '0:10:00.000 I/SYS: --- X-Plane has shut down ---',
    ].join('\n');
    const result = analyzeLog(log);
    expect(result.isXPlaneLog).toBe(true);
    expect(result.version).toBe('12.4.3-r2-15ff1e4d');
    expect(result.beta).toBe(false);
    expect(result.gpu).toBe('NVIDIA GeForce RTX 4070');
    expect(result.driver).toBe('32.0.15.6094');
    expect(result.cleanShutdown).toBe(true);
    expect(result.crashed).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('calls a log that just stops a crash and keeps its last lines', () => {
    const log = [...HEADER, '0:00:01.000 I/SYS: loading', '0:00:02.000 I/SCN: scenery'].join('\n');
    const result = analyzeLog(log);
    expect(result.cleanShutdown).toBe(false);
    expect(result.crashed).toBe(true);
    expect(result.context.slice(-2)).toEqual([
      '0:00:01.000 I/SYS: loading',
      '0:00:02.000 I/SCN: scenery',
    ]);
  });

  it('keeps the run of error lines around the crash marker', () => {
    const log = [
      ...HEADER,
      '0:00:01.000 I/SYS: fine',
      '0:00:02.000 E/PLG: Plugin assert: boom',
      '0:00:02.001 E/SYS: This application has crashed because of the plugin: Foo.xpl',
      '0:00:02.002 E/SYS: more',
      '0:00:02.003 I/SYS: unrelated',
    ].join('\n');
    const result = analyzeLog(log);
    expect(result.crashed).toBe(true);
    expect(result.context).toEqual([
      '0:00:02.000 E/PLG: Plugin assert: boom',
      '0:00:02.001 E/SYS: This application has crashed because of the plugin: Foo.xpl',
      '0:00:02.002 E/SYS: more',
    ]);
    expect(result.issues.map((issue) => [issue.id, issue.count])).toEqual([['plugin_assert', 1]]);
  });

  it('names known issues once each with a count, most specific first', () => {
    const log = [
      ...HEADER,
      '0:00:03.000 E/GFX/VK: VK_ERROR_DEVICE_LOST',
      '0:00:03.100 E/GFX/VK: VK_ERROR_DEVICE_LOST',
      '0:00:04.000 W/MEM: Entered heavy memory pressure state',
      "0:00:05.000 I/SYS: Dataref 'foo' has been replaced",
      '0:00:06.000 I/MEM: Entered regular memory pressure state',
      '0:10:00.000 I/SYS: X-Plane has shut down',
    ].join('\n');
    const result = analyzeLog(log);
    expect(
      result.issues.map((issue) => [issue.id, issue.severity, issue.count, issue.lineNo])
    ).toEqual([
      ['vulkan_error', 'error', 2, 7],
      ['memory_heavy', 'error', 1, 9],
      ['dataref_replaced', 'info', 1, 10],
      ['memory_regular', 'info', 1, 11],
    ]);
  });

  it('is not fooled by a file that is not a Log.txt', () => {
    const result = analyzeLog('just some text\nwith lines');
    expect(result.isXPlaneLog).toBe(false);
    expect(result.crashed).toBe(false);
  });
});

describe('scrubPaths', () => {
  it('replaces the X-Plane and home folders in either separator style', () => {
    const text =
      'at C:\\Games\\X-Plane 12\\Resources and C:/Users/me/Documents and C:\\Users\\me\\x';
    expect(scrubPaths(text, 'C:\\Games\\X-Plane 12', 'C:\\Users\\me')).toBe(
      'at <X-Plane>\\Resources and <home>/Documents and <home>\\x'
    );
  });
});
