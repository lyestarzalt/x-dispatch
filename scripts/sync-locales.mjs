#!/usr/bin/env node
// Sync locale files against en.json (source of truth).
//
// For every key path in en.json:
//   - If the target locale already has a string at that path, keep it.
//   - If it's missing, add it with the English value as a placeholder.
//   - Key order in each target file is rewritten to match en.json so diffs stay clean.
//
// Flags:
//   --prune     Remove keys from target locales that no longer exist in en.json.
//   --dry-run   Report what would change without writing.
//
// Usage:
//   node scripts/sync-locales.mjs
//   node scripts/sync-locales.mjs --prune
//   node scripts/sync-locales.mjs --dry-run

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LOCALES_DIR = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));
const SOURCE = 'en.json';

const args = new Set(process.argv.slice(2));
const PRUNE = args.has('--prune');
const DRY_RUN = args.has('--dry-run');

function syncTree(enNode, targetNode) {
  const added = [];
  const extraneous = [];
  const typeMismatch = [];

  function walk(en, tgt, pathArr) {
    if (typeof en === 'string') {
      if (typeof tgt === 'string') return tgt;
      if (tgt === undefined) {
        added.push(pathArr.join('.'));
        return en;
      }
      typeMismatch.push(pathArr.join('.'));
      return en;
    }

    // en is an object
    let tgtObj = tgt;
    if (tgtObj !== undefined && (typeof tgtObj !== 'object' || tgtObj === null || Array.isArray(tgtObj))) {
      typeMismatch.push(pathArr.join('.'));
      tgtObj = undefined;
    }

    const result = {};
    for (const [k, v] of Object.entries(en)) {
      const child = tgtObj ? tgtObj[k] : undefined;
      result[k] = walk(v, child, [...pathArr, k]);
    }

    if (tgtObj) {
      for (const k of Object.keys(tgtObj)) {
        if (!(k in en)) {
          extraneous.push([...pathArr, k].join('.'));
          if (!PRUNE) result[k] = tgtObj[k];
        }
      }
    }

    return result;
  }

  const synced = walk(enNode, targetNode, []);
  return { synced, added, extraneous, typeMismatch };
}

async function main() {
  const en = JSON.parse(await readFile(path.join(LOCALES_DIR, SOURCE), 'utf8'));
  const files = (await readdir(LOCALES_DIR))
    .filter((f) => f.endsWith('.json') && f !== SOURCE)
    .sort();

  let totalAdded = 0;
  let totalExtraneous = 0;
  let totalMismatch = 0;
  let totalChanged = 0;
  const report = [];

  for (const file of files) {
    const targetPath = path.join(LOCALES_DIR, file);
    const target = JSON.parse(await readFile(targetPath, 'utf8'));
    const { synced, added, extraneous, typeMismatch } = syncTree(en, target);

    const out = JSON.stringify(synced, null, 2) + '\n';
    const before = JSON.stringify(target, null, 2) + '\n';
    const changed = out !== before;

    totalAdded += added.length;
    totalExtraneous += extraneous.length;
    totalMismatch += typeMismatch.length;
    if (changed) totalChanged += 1;

    const parts = [`${file.padEnd(14)} +${added.length} added`];
    if (extraneous.length) parts.push(`${extraneous.length} extraneous${PRUNE ? ' (pruned)' : ''}`);
    if (typeMismatch.length) parts.push(`${typeMismatch.length} type mismatches`);
    if (!changed) parts.push('no changes');
    report.push({ file, line: parts.join(', '), added, extraneous, typeMismatch });

    if (changed && !DRY_RUN) {
      await writeFile(targetPath, out, 'utf8');
    }
  }

  const header = `Locale sync${DRY_RUN ? ' (dry-run)' : ''} — source: ${SOURCE}`;
  console.log('');
  console.log(header);
  console.log('─'.repeat(Math.max(60, header.length)));
  for (const r of report) console.log(r.line);
  console.log('─'.repeat(Math.max(60, header.length)));
  console.log(
    `Total: ${totalAdded} keys added, ${totalExtraneous} extraneous, ${totalMismatch} type mismatches, ${totalChanged}/${files.length} files changed`,
  );

  const allAdded = report.flatMap((r) => r.added.map((p) => `  ${r.file}: ${p}`));
  if (allAdded.length) {
    const limit = 40;
    console.log(
      allAdded.length > limit
        ? `\nAdded key paths (showing first ${limit} of ${allAdded.length}):`
        : '\nAdded key paths:',
    );
    console.log(allAdded.slice(0, limit).join('\n'));
  }

  if (totalMismatch > 0) {
    console.error('\nType mismatches found. Resolve manually before committing.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
