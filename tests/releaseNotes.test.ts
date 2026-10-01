import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, '..', 'scripts', 'release-notes.sh');
const REPO = 'https://github.com/lyestarzalt/x-dispatch';

function changelog(content: string) {
  const file = join(mkdtempSync(join(tmpdir(), 'changelog-')), 'CHANGELOG.md');
  writeFileSync(file, content);
  return file;
}

function run(...args: string[]) {
  return execFileSync('bash', [script, ...args], { encoding: 'utf8' });
}

const header = `# Changelog

All notable changes to X-Dispatch are documented in this file.
`;

const pending = `${header}
## [Unreleased]

### Added

- **Start Anywhere**: place your aircraft anywhere.

### Changed

### Fixed

- Airport search now tells you when nothing matches.
  More detail on the same line.

## [2.2.0] - 2026-09-29

### Added

- An older entry.

[unreleased]: ${REPO}/compare/v2.2.0...HEAD
[2.2.0]: ${REPO}/compare/v2.1.0...v2.2.0
`;

describe('release-notes.sh', () => {
  it('prints the Unreleased notes without empty sections', () => {
    expect(run('print', changelog(pending))).toBe(
      [
        '### Added',
        '',
        '- **Start Anywhere**: place your aircraft anywhere.',
        '',
        '### Fixed',
        '',
        '- Airport search now tells you when nothing matches.',
        '  More detail on the same line.',
        '',
      ].join('\n')
    );
  });

  it('refuses to release while Unreleased is empty, so commit messages never reach pilots', () => {
    expect(() => run('check', changelog(`${header}\n## [Unreleased]\n\n### Added\n\n`))).toThrow();
    expect(() => run('check', changelog(pending))).not.toThrow();
  });

  it('moves Unreleased into the new version and links it', () => {
    const file = changelog(pending);
    run('release', '2.3.0', '2026-10-02', file);
    expect(readFileSync(file, 'utf8')).toBe(`${header}
## [Unreleased]

## [2.3.0] - 2026-10-02

### Added

- **Start Anywhere**: place your aircraft anywhere.

### Fixed

- Airport search now tells you when nothing matches.
  More detail on the same line.

## [2.2.0] - 2026-09-29

### Added

- An older entry.

[unreleased]: ${REPO}/compare/v2.3.0...HEAD
[2.3.0]: ${REPO}/compare/v2.2.0...v2.3.0
[2.2.0]: ${REPO}/compare/v2.1.0...v2.2.0
`);
    expect(() => run('check', file)).toThrow();
  });
});
