import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Build-time only (called from forge.config.ts). MIT, BSD and Apache require their
// copyright and license text to ship with the app, and the bundler drops it from
// the code, so every production dependency's license file is collected here.

interface LockPackage {
  version?: string;
  license?: string;
  dev?: boolean;
  devOptional?: boolean;
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.|-|$)/i;

function readLicenseFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => LICENSE_FILE.test(name))
    .sort()
    .map((name) => readFileSync(path.join(dir, name), 'utf-8').trim());
}

export function buildThirdPartyLicenses(rootDir: string): string {
  const lock = JSON.parse(readFileSync(path.join(rootDir, 'package-lock.json'), 'utf-8')) as {
    packages: Record<string, LockPackage>;
  };

  const sections: string[] = [];
  for (const [key, pkg] of Object.entries(lock.packages)) {
    if (!key || pkg.dev || pkg.devOptional) continue;
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const texts = readLicenseFiles(path.join(rootDir, key));
    const header = `${name}@${pkg.version ?? '?'} (${pkg.license ?? 'see license text'})`;
    sections.push(
      [header, '-'.repeat(header.length), texts.join('\n\n') || 'No license file.'].join('\n')
    );
  }

  return [
    'X-Dispatch includes the following third-party software.',
    'Each package is used under the license shown with it.',
    '',
    ...sections,
  ].join('\n\n');
}
