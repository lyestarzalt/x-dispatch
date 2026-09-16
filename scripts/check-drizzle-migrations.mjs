#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Run drizzle-kit's bin with the current Node binary rather than going through
// `npx`. On Windows `npx` resolves to a .cmd shim, and since the
// CVE-2024-27980 hardening Node refuses to spawn .cmd/.bat without a shell:
// spawnSync returned EINVAL with a null status, so this script exited 1 with no
// output at all. Spawning the bin directly stays shell-free on every platform.
const drizzleKitBin = path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(`Failed to run \`${command}\`: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [drizzleKitBin, 'generate', '--name', 'ci-check']);

const status = execFileSync('git', ['status', '--porcelain', '--', 'drizzle'], {
  encoding: 'utf8',
}).trim();

if (status) {
  console.error('Schema changes detected but migrations were not generated.');
  console.error('Run: npx drizzle-kit generate --name describe-change');
  run('git', ['status', '--short', '--', 'drizzle']);
  run('git', ['diff', '--', 'drizzle']);
  process.exit(1);
}

console.log('Drizzle migrations are up to date');
