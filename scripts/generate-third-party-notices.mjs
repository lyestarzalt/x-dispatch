/**
 * Generates the third-party notices shipped with the app: every production dependency with its
 * licence text, plus the components that are not npm packages (7-Zip binaries, UnRAR, the
 * aircraft shapes, terrain data). Writes a human-readable text file and a JSON the About dialog
 * reads. `--check` verifies the committed files are current (CI).
 *
 *   node scripts/generate-third-party-notices.mjs
 *   node scripts/generate-third-party-notices.mjs --check
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const checker = require('license-checker-rseidelsohn');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'licenses');
const txtPath = path.join(outDir, 'THIRD-PARTY-NOTICES.txt');
const jsonPath = path.join(outDir, 'third-party-notices.json');
const check = process.argv.includes('--check');

const LICENSE_FILE_RE = /licen[cs]e|copying|notice/i;

function scan() {
  return new Promise((resolve, reject) => {
    checker.init({ start: root, production: true, excludePrivatePackages: true }, (err, json) =>
      err ? reject(err) : resolve(json)
    );
  });
}

function read(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
}

/** Components that are not npm packages or whose npm licence does not cover what we ship. */
function manualEntries() {
  return [
    {
      name: '7-Zip',
      version: undefined,
      license: 'LGPL-2.1-or-later AND BSD-3-Clause AND BSD-2-Clause WITH unRAR restriction',
      repository: 'https://7-zip.org',
      text: read(path.join(root, 'scripts', 'notices', '7-Zip.txt')),
    },
    {
      name: 'UnRAR',
      version: '6.1.7',
      license: 'UnRAR license (freeware)',
      repository: 'https://www.rarlab.com/rar_add.htm',
      // The UnRAR license requires this statement in the documentation of any software using it.
      text:
        'The UnRAR code included here (via node-unrar-js) may not be used to develop a RAR ' +
        '(WinRAR) compatible archiver.\n\n' +
        read(path.join(root, 'scripts', 'notices', 'UnRAR.txt')),
    },
    {
      name: 'Aircraft shapes',
      version: undefined,
      license: 'GPL-3.0',
      repository: 'https://github.com/RexKramer1/AircraftShapesSVG',
      text:
        'The aircraft top-view silhouettes in aircraft-shapes/ are by RexKramer1 and are ' +
        'licensed under the GNU General Public License v3.0. They are independent files loaded ' +
        'at runtime and remain under that license; the rest of X-Dispatch is not covered by it.\n\n' +
        read(path.join(root, 'public', 'aircraft-shapes', 'COPYING')),
    },
    {
      name: 'Mapterhorn terrain tiles',
      version: undefined,
      license: 'BSD-3-Clause (code); open data (tiles)',
      repository: 'https://mapterhorn.com',
      text:
        'Terrain elevation tiles are provided by Mapterhorn and built from open government and ' +
        'research datasets (among them Copernicus GLO-30 by the European Union and ESA, ' +
        'swissALTI3D by swisstopo, USGS 3DEP, national mapping agencies under CC BY 4.0 and ' +
        'compatible licences). The full list of sources and their attribution is published at ' +
        'https://mapterhorn.com/attribution/ and https://download.mapterhorn.com/attribution.json.',
    },
  ];
}

/**
 * Packages that are not part of every install: pinned to an OS or CPU (esbuild, rollup, Sentry
 * CLI binaries), or only reachable through such a package (the macOS DMG maker's tree), which
 * the lockfile records as optional. Which of them is installed depends on the machine, so they
 * are left out to keep the output identical on a Mac and on the Linux CI runner. All of them
 * are build-time tooling, never shipped in the app. A package is excluded only when every one
 * of its lockfile entries is optional or platform-bound.
 */
function machineSpecificPackages() {
  const lock = JSON.parse(read(path.join(root, 'package-lock.json')));
  const byId = new Map(); // "name@version" -> [isMachineSpecific, ...]
  for (const [key, info] of Object.entries(lock.packages ?? {})) {
    if (!key) continue;
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const id = `${name}@${info.version}`;
    const specific = Boolean(info.os || info.cpu || info.optional || info.devOptional);
    byId.set(id, [...(byId.get(id) ?? []), specific]);
  }
  return new Set([...byId].filter(([, flags]) => flags.every(Boolean)).map(([id]) => id));
}

async function build() {
  const scanned = await scan();
  const self = JSON.parse(read(path.join(root, 'package.json'))).name;
  const machineSpecific = machineSpecificPackages();
  const entries = [];
  for (const [id, info] of Object.entries(scanned)) {
    const at = id.lastIndexOf('@');
    const name = id.slice(0, at);
    const version = id.slice(at + 1);
    if (name === self) continue; // the app itself is not a third party
    if (machineSpecific.has(`${name}@${version}`)) continue;
    const licenseFile = info.licenseFile ?? '';
    const hasLicenseText = licenseFile && LICENSE_FILE_RE.test(path.basename(licenseFile));
    const text = hasLicenseText
      ? read(licenseFile)
      : `Licensed under ${info.licenses}. See ${info.repository ?? 'the package'} for the license text.`;
    entries.push({
      name,
      version,
      license: String(info.licenses),
      repository: info.repository ?? null,
      text,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const manual = manualEntries().map((e) => ({ ...e, version: e.version ?? null, manual: true }));
  return { entries: [...manual, ...entries] };
}

function renderText({ entries }) {
  const header =
    'X-Dispatch - Third-party notices\n' +
    'Generated by scripts/generate-third-party-notices.mjs. Do not edit.\n';
  const body = entries
    .map((e) => {
      const title = `${e.name}${e.version ? ` ${e.version}` : ''}`;
      const meta = [`License: ${e.license}`, e.repository ? `Source: ${e.repository}` : null]
        .filter(Boolean)
        .join('\n');
      return `${'-'.repeat(78)}\n${title}\n${meta}\n\n${e.text}\n`;
    })
    .join('\n');
  return `${header}\n${body}`;
}

const data = await build();
const txt = renderText(data);
// Pretty-printed and newline-terminated: the same shape a formatter would leave, so a hook
// touching the file cannot make it differ from what this script writes.
const json = `${JSON.stringify(data, null, 2)}\n`;

if (check) {
  const current = existsSync(jsonPath) ? readFileSync(jsonPath, 'utf8') : '';
  if (current !== json || !existsSync(txtPath) || readFileSync(txtPath, 'utf8') !== txt) {
    console.error(
      'Third-party notices are out of date. Run `npm run notices` and commit assets/licenses/.'
    );
    // Say what differs, so a machine-specific difference is visible in the CI log.
    const key = (e) => `${e.name}@${e.version ?? ''}`;
    const before = new Map((current ? JSON.parse(current).entries : []).map((e) => [key(e), e]));
    const after = new Map(data.entries.map((e) => [key(e), e]));
    for (const k of before.keys()) if (!after.has(k)) console.error(`  missing here: ${k}`);
    for (const k of after.keys()) if (!before.has(k)) console.error(`  new here:     ${k}`);
    for (const [k, e] of after) {
      const b = before.get(k);
      if (b && JSON.stringify(b) !== JSON.stringify(e)) {
        const field = ['license', 'repository', 'text'].find((f) => b[f] !== e[f]) ?? '?';
        console.error(`  changed:      ${k} (${field})`);
      }
    }
    process.exit(1);
  }
  console.log(`Third-party notices are current (${data.entries.length} components).`);
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(txtPath, txt);
  writeFileSync(jsonPath, json);
  console.log(`Wrote ${data.entries.length} components to ${path.relative(root, outDir)}/`);
}
