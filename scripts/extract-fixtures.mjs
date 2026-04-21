#!/usr/bin/env node
/**
 * Extracts test fixtures from X-Plane data files.
 * Run: node scripts/extract-fixtures.mjs
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';

const XPLANE_PATH = '/Users/lyes.t/Library/Application Support/Steam/steamapps/common/X-Plane 12';
const APT_DAT = path.join(XPLANE_PATH, 'Global Scenery/Global Airports/Earth nav data/apt.dat');
const NAV_DAT = path.join(XPLANE_PATH, 'Resources/default data/earth_nav.dat');
const FIX_DAT = path.join(XPLANE_PATH, 'Resources/default data/earth_fix.dat');
const AWY_DAT = path.join(XPLANE_PATH, 'Resources/default data/earth_awy.dat');
const AIRSPACE_TXT = path.join(XPLANE_PATH, 'Resources/default data/airspaces/airspace.txt');

const FIXTURES_DIR = path.resolve('./tests/fixtures');

// Target airports
const TARGET_ICAOS = new Set(['KJFK', 'EGLL', 'LFPG', 'KLAX', 'OTHH']);

async function extractAirports() {
  console.log('Extracting airports from apt.dat...');
  const rl = readline.createInterface({ input: fs.createReadStream(APT_DAT), crlfDelay: Infinity });

  let headerLines = [];
  let lineNum = 0;
  let inTargetAirport = false;
  let currentIcao = null;
  let airportBlocks = {};
  let currentBlock = [];

  for await (const line of rl) {
    lineNum++;

    // Capture header (first 2 non-empty lines)
    if (headerLines.length < 2) {
      headerLines.push(line);
      continue;
    }

    const tokens = line.trim().split(/\s+/);
    const rowCode = tokens[0];

    // Detect airport start: row codes 1, 16, 17
    if (rowCode === '1' || rowCode === '16' || rowCode === '17') {
      // Save previous airport if it was a target
      if (inTargetAirport && currentIcao && currentBlock.length > 0) {
        airportBlocks[currentIcao] = currentBlock;
        console.log(`  Found ${currentIcao} (${currentBlock.length} lines)`);
        if (Object.keys(airportBlocks).length === TARGET_ICAOS.size) {
          break; // Found all airports
        }
      }

      // Check if this airport is a target (ICAO is 5th token, index 4)
      const icao = tokens[4];
      if (TARGET_ICAOS.has(icao)) {
        inTargetAirport = true;
        currentIcao = icao;
        currentBlock = [line];
      } else {
        inTargetAirport = false;
        currentIcao = null;
        currentBlock = [];
      }
    } else if (rowCode === '99') {
      // End of file
      if (inTargetAirport && currentIcao && currentBlock.length > 0) {
        airportBlocks[currentIcao] = currentBlock;
        console.log(`  Found ${currentIcao} (${currentBlock.length} lines)`);
      }
      break;
    } else {
      if (inTargetAirport) {
        currentBlock.push(line);
      }
    }
  }

  // Write output
  const outLines = [...headerLines, ''];
  for (const icao of ['KJFK', 'EGLL', 'LFPG', 'KLAX', 'OTHH']) {
    if (airportBlocks[icao]) {
      outLines.push(...airportBlocks[icao]);
      outLines.push('');
    } else {
      console.warn(`  WARNING: ${icao} not found!`);
    }
  }
  outLines.push('99');

  const outPath = path.join(FIXTURES_DIR, 'apt-sample.dat');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  const found = Object.keys(airportBlocks);
  console.log(`  Wrote ${outPath} — airports: ${found.join(', ')}, lines: ${outLines.length}`);
}

async function extractNav() {
  console.log('Extracting nav data from earth_nav.dat...');
  const rl = readline.createInterface({ input: fs.createReadStream(NAV_DAT), crlfDelay: Infinity });

  let headerLines = [];
  let lineNum = 0;
  // Collect up to 20 lines per type code
  const byType = {};
  const targetTypes = new Set([2, 3, 4, 5, 6, 7, 8, 9, 12, 13]);
  const maxPerType = 20;

  for await (const line of rl) {
    lineNum++;
    if (headerLines.length < 2) {
      headerLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed === '99') continue;

    const rowCode = parseInt(trimmed.split(/\s+/)[0], 10);
    if (targetTypes.has(rowCode)) {
      if (!byType[rowCode]) byType[rowCode] = [];
      if (byType[rowCode].length < maxPerType) {
        byType[rowCode].push(line);
      }
    }

    // Check if we have enough of everything
    const allFull = [...targetTypes].every(t => (byType[t] || []).length >= maxPerType);
    if (allFull) break;
  }

  const outLines = [...headerLines, ''];
  for (const type of [2, 3, 4, 5, 6, 7, 8, 9, 12, 13]) {
    const lines = byType[type] || [];
    console.log(`  Type ${type}: ${lines.length} lines`);
    outLines.push(...lines);
  }
  outLines.push('99');

  const outPath = path.join(FIXTURES_DIR, 'earth_nav-sample.dat');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath} — total data lines: ${outLines.length - 3}`);
}

async function extractFixes() {
  console.log('Extracting waypoints from earth_fix.dat...');
  const rl = readline.createInterface({ input: fs.createReadStream(FIX_DAT), crlfDelay: Infinity });

  let headerLines = [];
  let dataLines = [];
  const maxLines = 100;

  for await (const line of rl) {
    if (headerLines.length < 2) {
      headerLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed === '99') continue;
    if (dataLines.length < maxLines) {
      dataLines.push(line);
    } else {
      break;
    }
  }

  const outLines = [...headerLines, '', ...dataLines, '99'];
  const outPath = path.join(FIXTURES_DIR, 'earth_fix-sample.dat');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath} — ${dataLines.length} waypoints`);
}

async function extractAirways() {
  console.log('Extracting airways from earth_awy.dat...');
  const rl = readline.createInterface({ input: fs.createReadStream(AWY_DAT), crlfDelay: Infinity });

  let headerLines = [];
  let dataLines = [];
  const maxLines = 50;

  for await (const line of rl) {
    if (headerLines.length < 2) {
      headerLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed === '99') continue;
    if (dataLines.length < maxLines) {
      dataLines.push(line);
    } else {
      break;
    }
  }

  const outLines = [...headerLines, '', ...dataLines, '99'];
  const outPath = path.join(FIXTURES_DIR, 'earth_awy-sample.dat');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath} — ${dataLines.length} airway segments`);
}

async function extractAirspaces() {
  console.log('Extracting airspaces from airspace.txt...');
  const content = fs.readFileSync(AIRSPACE_TXT, 'utf8');
  const lines = content.split('\n');

  // Split into blocks separated by blank lines
  let blocks = [];
  let current = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  // Take first 5 blocks
  const selectedBlocks = blocks.slice(0, 5);
  const outLines = [];
  for (let i = 0; i < selectedBlocks.length; i++) {
    if (i > 0) outLines.push('');
    outLines.push(...selectedBlocks[i]);
    // Log block summary
    const acLine = selectedBlocks[i].find(l => l.startsWith('AC '));
    const anLine = selectedBlocks[i].find(l => l.startsWith('AN '));
    console.log(`  Block ${i + 1}: ${acLine || '?'} — ${anLine || '?'} (${selectedBlocks[i].length} lines)`);
  }

  const outPath = path.join(FIXTURES_DIR, 'airspace-sample.txt');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`  Wrote ${outPath} — ${selectedBlocks.length} blocks`);
}

async function main() {
  console.log(`Writing fixtures to: ${FIXTURES_DIR}\n`);
  await extractAirports();
  console.log();
  await extractNav();
  console.log();
  await extractFixes();
  console.log();
  await extractAirways();
  console.log();
  await extractAirspaces();
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
