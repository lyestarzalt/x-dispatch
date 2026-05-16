#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(npx, ['drizzle-kit', 'generate', '--name', 'ci-check']);

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
