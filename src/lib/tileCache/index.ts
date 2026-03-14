import { TileCache } from './TileCache';
import type { TileCacheStats } from './TileCache';

let instance: TileCache | null = null;

export function initTileCache(): void {
  if (instance) return;
  instance = new TileCache();
  instance.init();
}

export function getTileCache(): TileCache {
  if (!instance) {
    throw new Error('TileCache not initialized. Call initTileCache() first.');
  }
  return instance;
}

export function closeTileCache(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export type { TileCacheStats };
export { registerTileCacheScheme, registerTileCacheHandler } from './protocolHandler';
