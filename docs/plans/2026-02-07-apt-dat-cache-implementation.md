# apt.dat Cache Invalidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect apt.dat file changes on startup, auto-reload when changed, with fast batch inserts and extended metadata extraction.

**Architecture:** Track file mtimes in `apt_file_meta` table, compare on startup, full reload if any changed. Extract 1302 metadata rows into dedicated columns. Use Drizzle batch inserts (500 chunk size) for 5-10x performance.

**Tech Stack:** Drizzle ORM, sql.js, TypeScript, Node.js fs.stat

---

## Task 1: Update Database Schema

**Files:**

- Modify: `src/db/schema.ts`

**Step 1: Add aptFileMeta table and extend airports table**

Replace entire file with:

```typescript
/**
 * Database Schema - Drizzle ORM
 * Defines all tables for X-Plane data storage
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Airports table - stores airport data from apt.dat
 */
export const airports = sqliteTable(
  'airports',
  {
    icao: text('icao').primaryKey(),
    name: text('name').notNull(),
    lat: real('lat').notNull(),
    lon: real('lon').notNull(),
    type: text('type', { enum: ['land', 'seaplane', 'heliport'] }).notNull(),
    elevation: integer('elevation'),
    data: text('data'),
    sourceFile: text('source_file'),
    // Metadata from 1302 rows
    city: text('city'),
    country: text('country'),
    iataCode: text('iata_code'),
    faaCode: text('faa_code'),
    regionCode: text('region_code'),
    state: text('state'),
    transitionAlt: integer('transition_alt'),
    transitionLevel: text('transition_level'),
    towerServiceType: text('tower_service_type'),
    driveOnLeft: integer('drive_on_left', { mode: 'boolean' }),
    guiLabel: text('gui_label'),
  },
  (table) => [
    index('idx_airports_coords').on(table.lat, table.lon),
    index('idx_airports_iata').on(table.iataCode),
    index('idx_airports_country').on(table.country),
    index('idx_airports_region').on(table.regionCode),
  ]
);

/**
 * Track apt.dat file metadata for cache invalidation
 */
export const aptFileMeta = sqliteTable('apt_file_meta', {
  path: text('path').primaryKey(),
  mtime: integer('mtime').notNull(),
  airportCount: integer('airport_count'),
});

/**
 * Metadata table - stores app configuration and state
 */
export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// Type exports
export type Airport = typeof airports.$inferSelect;
export type NewAirport = typeof airports.$inferInsert;
export type AptFileMeta = typeof aptFileMeta.$inferSelect;
export type NewAptFileMeta = typeof aptFileMeta.$inferInsert;
export type Metadata = typeof metadata.$inferSelect;
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing errors only)

**Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): add aptFileMeta table and airport metadata columns"
```

---

## Task 2: Update Database Initialization

**Files:**

- Modify: `src/db/index.ts`

**Step 1: Update initTables function**

Find the `initTables()` function and replace it with:

```typescript
function initTables(): void {
  if (!sqlite) return;

  // Drop and recreate airports table with new columns
  sqlite.run(`DROP TABLE IF EXISTS airports`);
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS airports (
      icao TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('land', 'seaplane', 'heliport')),
      elevation INTEGER,
      data TEXT,
      source_file TEXT,
      city TEXT,
      country TEXT,
      iata_code TEXT,
      faa_code TEXT,
      region_code TEXT,
      state TEXT,
      transition_alt INTEGER,
      transition_level TEXT,
      tower_service_type TEXT,
      drive_on_left INTEGER,
      gui_label TEXT
    );
  `);

  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_coords ON airports(lat, lon);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata_code);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(country);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_region ON airports(region_code);`);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS apt_file_meta (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL,
      airport_count INTEGER
    );
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing errors only)

**Step 3: Commit**

```bash
git add src/db/index.ts
git commit -m "feat(db): update table creation for new schema"
```

---

## Task 3: Create Airport Parser Types

**Files:**

- Create: `src/lib/xplaneData/types.ts`

**Step 1: Create types file**

```typescript
/**
 * Types for apt.dat parsing
 */

export interface ParsedAirportEntry {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  type: 'land' | 'seaplane' | 'heliport';
  elevation?: number;
  data: string;
  sourceFile: string;
  // Metadata from 1302 rows
  city?: string;
  country?: string;
  iataCode?: string;
  faaCode?: string;
  regionCode?: string;
  state?: string;
  transitionAlt?: number;
  transitionLevel?: string;
  towerServiceType?: string;
  driveOnLeft?: boolean;
  guiLabel?: string;
}

export interface AptFileInfo {
  path: string;
  mtime: number;
}

export interface CacheCheckResult {
  needsReload: boolean;
  changedFiles: string[];
  newFiles: string[];
  deletedFiles: string[];
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Pass

**Step 3: Commit**

```bash
git add src/lib/xplaneData/types.ts
git commit -m "feat(xplane): add types for apt.dat parsing"
```

---

## Task 4: Add Mtime Checking Methods

**Files:**

- Modify: `src/lib/xplaneData/XPlaneDataManager.ts`

**Step 1: Add imports at top of file**

After existing imports, add:

```typescript
import { aptFileMeta } from '../../db';
import type { AptFileInfo, CacheCheckResult, ParsedAirportEntry } from './types';
```

**Step 2: Add helper methods to XPlaneDataManager class**

Add these methods inside the class (before `loadAirports`):

```typescript
/**
 * Get file modification time in milliseconds
 */
private getFileMtime(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor(stat.mtimeMs);
  } catch {
    return null;
  }
}

/**
 * Get stored file metadata from database
 */
private getStoredFileMeta(): Map<string, number> {
  const db = getDb();
  const stored = db.select().from(aptFileMeta).all();
  const map = new Map<string, number>();
  for (const row of stored) {
    map.set(row.path, row.mtime);
  }
  return map;
}

/**
 * Get current apt.dat files with their mtimes
 */
private getCurrentAptFiles(xplanePath: string): AptFileInfo[] {
  const files: AptFileInfo[] = [];

  // Global apt.dat
  const globalPath = getAptDataPath(xplanePath);
  const globalMtime = this.getFileMtime(globalPath);
  if (globalMtime !== null) {
    files.push({ path: globalPath, mtime: globalMtime });
  }

  // Custom Scenery apt.dat files
  const customFiles = this.getCustomSceneryAptFiles(xplanePath);
  for (const customPath of customFiles) {
    const mtime = this.getFileMtime(customPath);
    if (mtime !== null) {
      files.push({ path: customPath, mtime });
    }
  }

  return files;
}

/**
 * Check if cache needs to be reloaded
 */
private checkCacheValidity(xplanePath: string): CacheCheckResult {
  const stored = this.getStoredFileMeta();
  const current = this.getCurrentAptFiles(xplanePath);

  const changedFiles: string[] = [];
  const newFiles: string[] = [];
  const deletedFiles: string[] = [];

  const currentPaths = new Set(current.map((f) => f.path));

  // Check for changed or new files
  for (const file of current) {
    const storedMtime = stored.get(file.path);
    if (storedMtime === undefined) {
      newFiles.push(file.path);
    } else if (storedMtime !== file.mtime) {
      changedFiles.push(file.path);
    }
  }

  // Check for deleted files
  for (const storedPath of stored.keys()) {
    if (!currentPaths.has(storedPath)) {
      deletedFiles.push(storedPath);
    }
  }

  const needsReload = changedFiles.length > 0 || newFiles.length > 0 || deletedFiles.length > 0;

  return { needsReload, changedFiles, newFiles, deletedFiles };
}

/**
 * Update stored file metadata after successful load
 */
private updateStoredFileMeta(files: AptFileInfo[], airportCounts: Map<string, number>): void {
  const db = getDb();

  // Clear existing
  db.delete(aptFileMeta).run();

  // Insert current state
  const entries = files.map((f) => ({
    path: f.path,
    mtime: f.mtime,
    airportCount: airportCounts.get(f.path) ?? 0,
  }));

  if (entries.length > 0) {
    db.insert(aptFileMeta).values(entries).run();
  }
}
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing errors only)

**Step 4: Commit**

```bash
git add src/lib/xplaneData/XPlaneDataManager.ts
git commit -m "feat(xplane): add file mtime checking for cache invalidation"
```

---

## Task 5: Update parseAptFile for Metadata Extraction

**Files:**

- Modify: `src/lib/xplaneData/XPlaneDataManager.ts`

**Step 1: Replace parseAptFile method**

Find the existing `parseAptFile` method and replace it entirely with:

```typescript
/**
 * Parse a single apt.dat file and return airport data with metadata
 */
private async parseAptFile(aptPath: string): Promise<Map<string, ParsedAirportEntry>> {
  const airports = new Map<string, ParsedAirportEntry>();

  const reader = new FastFileReader(aptPath);

  let currentAirport: {
    icao: string;
    name: string;
    datumLat: number;
    datumLon: number;
    runwayLat: number;
    runwayLon: number;
    elevation: number;
    type: 'land' | 'seaplane' | 'heliport';
    data: string[];
    // Metadata
    city?: string;
    country?: string;
    iataCode?: string;
    faaCode?: string;
    regionCode?: string;
    state?: string;
    transitionAlt?: number;
    transitionLevel?: string;
    towerServiceType?: string;
    driveOnLeft?: boolean;
    guiLabel?: string;
  } | null = null;

  const finalizeAirport = () => {
    if (!currentAirport) return;

    // Prefer datum coordinates, fallback to runway/helipad coordinates
    const lat = currentAirport.datumLat || currentAirport.runwayLat;
    const lon = currentAirport.datumLon || currentAirport.runwayLon;

    if (lat && lon) {
      airports.set(currentAirport.icao, {
        icao: currentAirport.icao,
        name: currentAirport.name,
        lat,
        lon,
        type: currentAirport.type,
        elevation: currentAirport.elevation || undefined,
        data: currentAirport.data.join('\n'),
        sourceFile: aptPath,
        // Metadata
        city: currentAirport.city,
        country: currentAirport.country,
        iataCode: currentAirport.iataCode,
        faaCode: currentAirport.faaCode,
        regionCode: currentAirport.regionCode,
        state: currentAirport.state,
        transitionAlt: currentAirport.transitionAlt,
        transitionLevel: currentAirport.transitionLevel,
        towerServiceType: currentAirport.towerServiceType,
        driveOnLeft: currentAirport.driveOnLeft,
        guiLabel: currentAirport.guiLabel,
      });
    }
  };

  for await (const { line } of reader.readLines()) {
    if (line.trim() === '99') {
      finalizeAirport();
      break;
    }

    // Airport/Seaplane/Heliport header (row codes 1, 16, 17)
    if (line.match(/^(1|16|17)\s/)) {
      finalizeAirport();

      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        currentAirport = {
          icao: parts[4],
          name: parts.slice(5).join(' '),
          datumLat: 0,
          datumLon: 0,
          runwayLat: 0,
          runwayLon: 0,
          elevation: parseInt(parts[1]) || 0,
          type: parts[0] === '1' ? 'land' : parts[0] === '16' ? 'seaplane' : 'heliport',
          data: [line],
        };
      }
      continue;
    }

    if (!currentAirport) continue;

    // Metadata (row code 1302)
    if (line.startsWith('1302 ')) {
      const parts = line.split(/\s+/);
      const key = parts[1];
      const value = parts.slice(2).join(' ').trim();

      if (value) {
        switch (key) {
          case 'city':
            currentAirport.city = value;
            break;
          case 'country':
            currentAirport.country = value;
            break;
          case 'iata_code':
            currentAirport.iataCode = value;
            break;
          case 'faa_code':
            currentAirport.faaCode = value;
            break;
          case 'region_code':
            currentAirport.regionCode = value;
            break;
          case 'state':
            currentAirport.state = value;
            break;
          case 'transition_alt':
            currentAirport.transitionAlt = parseInt(value) || undefined;
            break;
          case 'transition_level':
            currentAirport.transitionLevel = value;
            break;
          case 'tower_service_type':
            currentAirport.towerServiceType = value;
            break;
          case 'drive_on_left':
            currentAirport.driveOnLeft = value === '1';
            break;
          case 'gui_label':
            currentAirport.guiLabel = value;
            break;
          case 'datum_lat':
            currentAirport.datumLat = parseFloat(value);
            break;
          case 'datum_lon':
            currentAirport.datumLon = parseFloat(value);
            break;
        }
      }
    }

    // Runway (row code 100) - extract first runway end coordinates as fallback
    if (line.startsWith('100 ') && !currentAirport.runwayLat) {
      const parts = line.split(/\s+/);
      if (parts.length >= 10) {
        const lat = parseFloat(parts[9]);
        const lon = parseFloat(parts[10]);
        if (!isNaN(lat) && !isNaN(lon)) {
          currentAirport.runwayLat = lat;
          currentAirport.runwayLon = lon;
        }
      }
    }

    // Helipad (row code 102) - extract coordinates as fallback
    if (line.startsWith('102 ') && !currentAirport.runwayLat) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const lat = parseFloat(parts[2]);
        const lon = parseFloat(parts[3]);
        if (!isNaN(lat) && !isNaN(lon)) {
          currentAirport.runwayLat = lat;
          currentAirport.runwayLon = lon;
        }
      }
    }

    currentAirport.data.push(line);
  }

  return airports;
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing errors only)

**Step 3: Commit**

```bash
git add src/lib/xplaneData/XPlaneDataManager.ts
git commit -m "feat(xplane): extract 1302 metadata during apt.dat parsing"
```

---

## Task 6: Update loadAirports with Batch Inserts

**Files:**

- Modify: `src/lib/xplaneData/XPlaneDataManager.ts`

**Step 1: Replace loadAirports method**

Find the existing `loadAirports` method and replace it entirely with:

```typescript
/**
 * Load airport data from Global Airports and Custom Scenery
 * Uses batch inserts for performance and checks cache validity
 */
private async loadAirports(xplanePath: string): Promise<void> {
  // Check if we need to reload
  const cacheCheck = this.checkCacheValidity(xplanePath);

  if (!cacheCheck.needsReload) {
    logger.data.info('Airport cache is valid, skipping reload');
    this.loadStatus.airports = true;
    return;
  }

  if (cacheCheck.changedFiles.length > 0) {
    logger.data.info(`Changed apt.dat files: ${cacheCheck.changedFiles.length}`);
  }
  if (cacheCheck.newFiles.length > 0) {
    logger.data.info(`New apt.dat files: ${cacheCheck.newFiles.length}`);
  }
  if (cacheCheck.deletedFiles.length > 0) {
    logger.data.info(`Deleted apt.dat files: ${cacheCheck.deletedFiles.length}`);
  }

  const globalAptPath = getAptDataPath(xplanePath);
  const customAptFiles = this.getCustomSceneryAptFiles(xplanePath);
  const currentFiles = this.getCurrentAptFiles(xplanePath);

  // Store all airports by ICAO (Custom Scenery will override Global)
  const allAirports = new Map<string, ParsedAirportEntry>();
  const airportCounts = new Map<string, number>();

  // Track which ICAOs came from Global vs Custom
  const globalIcaos = new Set<string>();
  const customIcaos = new Set<string>();

  // 1. Load Global Airports first
  if (fs.existsSync(globalAptPath)) {
    logger.data.info(`Loading Global Airports from: ${globalAptPath}`);
    const globalAirports = await this.parseAptFile(globalAptPath);
    airportCounts.set(globalAptPath, globalAirports.size);
    for (const [icao, airport] of globalAirports) {
      allAirports.set(icao, airport);
      globalIcaos.add(icao);
    }
    logger.data.info(`Loaded ${globalAirports.size} airports from Global Airports`);
  } else {
    logger.data.warn(`Global apt.dat not found: ${globalAptPath}`);
  }

  // 2. Load Custom Scenery (overrides Global)
  if (customAptFiles.length > 0) {
    logger.data.info(`Found ${customAptFiles.length} Custom Scenery apt.dat files`);
    for (const aptFile of customAptFiles) {
      const customAirports = await this.parseAptFile(aptFile);
      airportCounts.set(aptFile, customAirports.size);
      for (const [icao, airport] of customAirports) {
        allAirports.set(icao, airport); // Override global
        customIcaos.add(icao);
      }
    }
  }

  // Calculate source breakdown
  const customCount = customIcaos.size;
  const globalOnlyCount = [...globalIcaos].filter((icao) => !customIcaos.has(icao)).length;

  this.airportSourceCounts = {
    globalAirports: globalOnlyCount,
    customScenery: customCount,
    customSceneryPacks: customAptFiles.length,
  };

  logger.data.info(
    `Airport breakdown: ${globalOnlyCount} from Global, ${customCount} from Custom Scenery (${customAptFiles.length} packs)`
  );

  // 3. Batch insert all airports into database
  const db = getDb();
  const startInsert = Date.now();

  // Clear existing airports
  db.delete(airports).run();

  // Convert to array for batch insert
  const airportArray = Array.from(allAirports.values()).map((a) => ({
    icao: a.icao,
    name: a.name,
    lat: a.lat,
    lon: a.lon,
    type: a.type,
    elevation: a.elevation,
    data: a.data,
    sourceFile: a.sourceFile,
    city: a.city,
    country: a.country,
    iataCode: a.iataCode,
    faaCode: a.faaCode,
    regionCode: a.regionCode,
    state: a.state,
    transitionAlt: a.transitionAlt,
    transitionLevel: a.transitionLevel,
    towerServiceType: a.towerServiceType,
    driveOnLeft: a.driveOnLeft,
    guiLabel: a.guiLabel,
  }));

  // Batch insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < airportArray.length; i += CHUNK_SIZE) {
    const chunk = airportArray.slice(i, i + CHUNK_SIZE);
    db.insert(airports).values(chunk).run();
  }

  const insertTime = Date.now() - startInsert;
  logger.data.info(`Batch inserted ${allAirports.size} airports in ${insertTime}ms`);

  // 4. Update file metadata cache
  this.updateStoredFileMeta(currentFiles, airportCounts);

  // 5. Save database
  saveDb();
  logger.data.info(`Stored ${allAirports.size} total airports (Global + Custom Scenery)`);

  this.loadStatus.airports = true;
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing errors only)

**Step 3: Commit**

```bash
git add src/lib/xplaneData/XPlaneDataManager.ts
git commit -m "feat(xplane): implement batch inserts and cache checking"
```

---

## Task 7: Update clear() Method

**Files:**

- Modify: `src/lib/xplaneData/XPlaneDataManager.ts`

**Step 1: Update clear method to also clear aptFileMeta**

Find the `clear()` method and replace it with:

```typescript
/**
 * Clear all loaded data
 */
clear(): void {
  this.navaids = [];
  this.waypoints = [];
  this.airspaces = [];
  this.airways = [];
  this.atcControllers = [];
  this.holdingPatterns = [];
  this.airportMetadata = new Map();
  this.dataSources = null;
  this.loadStatus = {
    airports: false,
    navaids: false,
    waypoints: false,
    airspaces: false,
    airways: false,
    atc: false,
    holds: false,
    aptMeta: false,
  };

  const db = getDb();
  db.delete(airports).run();
  db.delete(aptFileMeta).run();
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing errors only)

**Step 3: Commit**

```bash
git add src/lib/xplaneData/XPlaneDataManager.ts
git commit -m "feat(xplane): update clear to also clear aptFileMeta"
```

---

## Task 8: Final Verification

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: Pass (or same pre-existing LaunchDialog errors only)

**Step 2: Run lint**

Run: `npm run lint`
Expected: Pass (or minor fixable issues)

**Step 3: Fix any lint issues**

Run: `npm run lint:fix`

**Step 4: Manual test checklist**

1. Delete the app's database file (in userData folder)
2. Start the app with `npm start`
3. Verify airports load and metadata is populated
4. Check logs for "Batch inserted X airports in Yms"
5. Restart app - should see "Airport cache is valid, skipping reload"
6. Modify a Custom Scenery apt.dat file's mtime: `touch "/path/to/Custom Scenery/pack/Earth nav data/apt.dat"`
7. Restart app - should reload

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint and final verification"
```

---

## Verification Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] First startup parses and batch inserts airports
- [ ] Insert time logged in milliseconds
- [ ] Second startup skips reload (cache valid)
- [ ] Modifying apt.dat file triggers reload
- [ ] Metadata fields populated (check DAAG for transition_alt)
