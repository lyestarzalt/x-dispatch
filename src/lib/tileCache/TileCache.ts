import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/utils/logger';

interface CacheEntry {
  url: string;
  contentType: string;
  size: number;
  createdAt: number;
  accessedAt: number;
  ttl: number;
}

export interface TileCacheStats {
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

/** TTL in milliseconds by tile source */
const TTL_RAINVIEWER = 10 * 60 * 1000; // 10 minutes
const TTL_TERRAIN = 30 * 24 * 60 * 60 * 1000; // 30 days
const TTL_DEFAULT = 7 * 24 * 60 * 60 * 1000; // 7 days

const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500 MB
const MANIFEST_FLUSH_INTERVAL = 60_000; // 60 seconds
const EVICT_TARGET_RATIO = 0.9; // Evict until 90% of max

function hashUrl(url: string): string {
  // MD5 is fine here — not security-sensitive, just deduplication
  return crypto.createHash('md5').update(url).digest('hex');
}

function getTtlForUrl(url: string): number {
  if (url.includes('rainviewer.com')) return TTL_RAINVIEWER;
  if (url.includes('terrain') || url.includes('elevation')) return TTL_TERRAIN;
  return TTL_DEFAULT;
}

export class TileCache {
  private cacheDir: string;
  private tilesDir: string;
  private manifestPath: string;
  private manifest = new Map<string, CacheEntry>();
  private totalSize = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'tile-cache');
    this.tilesDir = path.join(this.cacheDir, 'tiles');
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
  }

  init(): void {
    // Create directories
    fs.mkdirSync(this.tilesDir, { recursive: true });

    // Load manifest
    this.loadManifest();

    // Purge expired entries
    this.purgeExpired();

    // Start periodic flush
    this.flushTimer = setInterval(() => this.flushManifest(), MANIFEST_FLUSH_INTERVAL);

    logger.main.info(
      `Tile cache initialized: ${this.manifest.size} entries, ${Math.round(this.totalSize / 1024 / 1024)}MB`
    );
  }

  async get(url: string): Promise<{ data: Buffer; contentType: string } | null> {
    const hash = hashUrl(url);
    const entry = this.manifest.get(hash);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > entry.ttl) {
      this.removeEntry(hash);
      this.misses++;
      return null;
    }

    // Read tile data asynchronously
    const tilePath = path.join(this.tilesDir, hash);
    try {
      const data = await fsp.readFile(tilePath);
      // Update access time (batched — flushed with manifest)
      entry.accessedAt = Date.now();
      this.dirty = true;
      this.hits++;
      return { data, contentType: entry.contentType };
    } catch {
      // File missing on disk — remove stale manifest entry
      this.removeEntry(hash);
      this.misses++;
      return null;
    }
  }

  put(url: string, data: Buffer, contentType: string): void {
    const hash = hashUrl(url);
    const size = data.length;

    // Evict if needed before writing
    if (this.totalSize + size > MAX_CACHE_SIZE) {
      this.evict(size);
    }

    // Update manifest immediately (in-memory)
    const existing = this.manifest.get(hash);
    if (existing) {
      this.totalSize -= existing.size;
    }

    const now = Date.now();
    this.manifest.set(hash, {
      url,
      contentType,
      size,
      createdAt: now,
      accessedAt: now,
      ttl: getTtlForUrl(url),
    });
    this.totalSize += size;
    this.dirty = true;

    // Write tile to disk asynchronously — don't block the response
    const tilePath = path.join(this.tilesDir, hash);
    fsp.writeFile(tilePath, data).catch((err) => {
      logger.main.error('Tile cache write failed', err);
      // Rollback manifest entry on write failure
      this.manifest.delete(hash);
      this.totalSize -= size;
    });
  }

  clear(): void {
    // Remove all tile files
    try {
      const files = fs.readdirSync(this.tilesDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(this.tilesDir, file));
        } catch {
          /* best effort */
        }
      }
    } catch {
      /* dir may not exist */
    }

    this.manifest.clear();
    this.totalSize = 0;
    this.hits = 0;
    this.misses = 0;
    this.dirty = true;
    this.flushManifest();

    logger.main.info('Tile cache cleared');
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushManifest();
    logger.main.info('Tile cache closed');
  }

  getStats(): TileCacheStats {
    const total = this.hits + this.misses;
    return {
      totalSize: this.totalSize,
      entryCount: this.manifest.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────

  private loadManifest(): void {
    try {
      if (!fs.existsSync(this.manifestPath)) return;
      const raw = fs.readFileSync(this.manifestPath, 'utf-8');
      const entries: [string, CacheEntry][] = JSON.parse(raw);
      this.manifest = new Map(entries);
      this.totalSize = 0;
      for (const entry of this.manifest.values()) {
        this.totalSize += entry.size;
      }
    } catch (err) {
      logger.main.warn('Tile cache manifest load failed, starting fresh', err);
      this.manifest.clear();
      this.totalSize = 0;
    }
  }

  private flushManifest(): void {
    if (!this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.manifestPath), { recursive: true });
      const data = JSON.stringify([...this.manifest.entries()]);
      fs.writeFileSync(this.manifestPath, data, 'utf-8');
      this.dirty = false;
    } catch (err) {
      logger.main.error('Tile cache manifest flush failed', err);
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    for (const [hash, entry] of this.manifest) {
      if (now - entry.createdAt > entry.ttl) {
        this.removeEntry(hash);
        purged++;
      }
    }
    if (purged > 0) {
      logger.main.info(`Tile cache purged ${purged} expired entries`);
    }
  }

  private evict(neededBytes: number): void {
    const target = MAX_CACHE_SIZE * EVICT_TARGET_RATIO - neededBytes;
    if (this.totalSize <= target) return;

    // Sort by accessedAt ascending (oldest accessed first)
    const sorted = [...this.manifest.entries()].sort((a, b) => a[1].accessedAt - b[1].accessedAt);

    let evicted = 0;
    for (const [hash] of sorted) {
      if (this.totalSize <= target) break;
      this.removeEntry(hash);
      evicted++;
    }

    if (evicted > 0) {
      logger.main.info(
        `Tile cache evicted ${evicted} entries, now ${Math.round(this.totalSize / 1024 / 1024)}MB`
      );
    }
  }

  private removeEntry(hash: string): void {
    const entry = this.manifest.get(hash);
    if (!entry) return;

    this.totalSize -= entry.size;
    this.manifest.delete(hash);
    this.dirty = true;

    // Async delete — don't block
    fsp.unlink(path.join(this.tilesDir, hash)).catch(() => {
      /* file already gone */
    });
  }
}
