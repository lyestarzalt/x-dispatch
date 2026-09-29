import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, '..', 'scripts', 'publish-r2.sh');

function plan(args: string[], input: string[], env: Record<string, string> = {}) {
  const out = execFileSync('bash', [script, ...args], {
    input: input.join('\n'),
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

const tags = [
  'v1.9.2',
  'v2.0.0',
  'v2.0.1',
  'v2.1.0',
  'v2.2.0',
  'v2.2.0-rc.5',
  'v2.2.0-rc.6',
  'v2.3.0-rc.1',
];

describe('publish-r2.sh prune-plan', () => {
  it('keeps the current stable, the previous one and the current RC', () => {
    expect(plan(['prune-plan', 'v2.2.0', 'v2.3.0-rc.1'], tags)).toEqual([
      'v1.9.2',
      'v2.0.0',
      'v2.0.1',
      'v2.2.0-rc.5',
      'v2.2.0-rc.6',
    ]);
  });

  it('orders versions numerically, not alphabetically', () => {
    expect(
      plan(
        ['prune-plan', 'v2.10.0', 'v2.10.0-rc.2'],
        ['v2.9.0', 'v2.10.0', 'v2.8.0', 'v2.10.0-rc.10', 'v2.10.0-rc.2']
      )
    ).toEqual(['v2.8.0', 'v2.10.0-rc.10']);
  });

  it('never deletes a pointer tag, even when older builds are newer', () => {
    // A rollback points latest.json at v2.1.0 while v2.2.0 is still on R2.
    expect(plan(['prune-plan', 'v2.1.0', 'v2.3.0-rc.1'], tags)).not.toContain('v2.1.0');
  });

  it('honours KEEP_STABLE', () => {
    expect(plan(['prune-plan', 'v2.2.0', 'v2.3.0-rc.1'], tags, { KEEP_STABLE: '1' })).toContain(
      'v2.1.0'
    );
  });

  it('leaves a channel alone when its pointer is unknown', () => {
    expect(plan(['prune-plan', '', ''], tags)).toEqual([]);
  });

  it('lists Windows packages that RELEASES no longer names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'r2-feed-'));
    const releases = join(dir, 'RELEASES');
    writeFileSync(releases, 'ABC123 XDispatch-2.2.0-full.nupkg 176600000\n');
    expect(
      plan(
        ['feed-prune-plan', releases],
        ['XDispatch-2.1.0-full.nupkg', 'XDispatch-2.2.0-full.nupkg']
      )
    ).toEqual(['XDispatch-2.1.0-full.nupkg']);
  });
});
