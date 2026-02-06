# apt.dat Cache Invalidation & Performance - Design

## Overview

Improve apt.dat loading with file change detection, cache invalidation, and batch insert performance.

## Goals

1. **Detect file changes** - Track apt.dat file mtimes, reload only when changed
2. **Fast inserts** - Batch inserts with Drizzle ORM (5-10x faster)
3. **Extended metadata** - Extract and store all 1302 metadata fields

## Design Decisions

- **Trigger**: File mtime changes only (not X-Plane version)
- **Check timing**: App startup only
- **Action on change**: Auto-reload silently (full reload for simplicity)
- **Override handling**: Custom Scenery overrides Global (X-Plane behavior)

---

## Database Schema Changes

### Updated `airports` table

```typescript
export const airports = sqliteTable(
  'airports',
  {
    // Core fields
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
```

### New `apt_file_meta` table

```typescript
export const aptFileMeta = sqliteTable('apt_file_meta', {
  path: text('path').primaryKey(),
  mtime: integer('mtime').notNull(),
  airportCount: integer('airport_count'),
});
```

---

## Startup Flow

```
App starts
    ↓
Query apt_file_meta for stored files + mtimes
    ↓
Scan actual files (Global apt.dat + Custom Scenery folders)
    ↓
Compare mtimes:
  - All same? → Skip reload, use cached data
  - Any different/new/deleted? → Full reload
    ↓
If reloading:
  1. Parse Global apt.dat first
  2. Parse Custom Scenery apt.dat files (override Global)
  3. Batch insert to database
  4. Update apt_file_meta with current mtimes
```

---

## Performance: Batch Inserts

### Current (slow)

```typescript
for (const airport of allAirports.values()) {
  sqlite.run('INSERT ...', [...]);  // One at a time
}
```

### Optimized with Drizzle

```typescript
const db = getDb();
db.delete(airports).run();

const CHUNK_SIZE = 500;
const airportArray = Array.from(allAirports.values());

for (let i = 0; i < airportArray.length; i += CHUNK_SIZE) {
  const chunk = airportArray.slice(i, i + CHUNK_SIZE);
  db.insert(airports).values(chunk).run();
}
```

**Expected improvement**: 5-10x faster inserts

---

## Parsing: Extract 1302 Metadata

```typescript
if (line.startsWith('1302 ')) {
  const parts = line.split(/\s+/);
  const key = parts[1];
  const value = parts.slice(2).join(' ');

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
      currentAirport.transitionAlt = parseInt(value);
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
```

---

## Files to Modify

| File                                      | Change                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| `src/db/schema.ts`                        | Add `aptFileMeta` table, extend `airports` with metadata fields |
| `src/db/index.ts`                         | Add table creation for `apt_file_meta`                          |
| `src/lib/xplaneData/XPlaneDataManager.ts` | Batch inserts, mtime checking, metadata extraction              |

---

## Verification

1. `npm run typecheck && npm run lint`
2. Test startup with existing database (should skip reload if unchanged)
3. Modify a Custom Scenery apt.dat, restart (should detect and reload)
4. Verify metadata fields populated (check DAAG for transition_alt, EGPR for drive_on_left)
5. Measure insert time improvement vs current implementation
