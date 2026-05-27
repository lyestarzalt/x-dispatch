import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';

export interface MbtilesMetadata {
  name?: string;
  format?: string;
  bounds?: string;
  minzoom?: string;
  maxzoom?: string;
  center?: string;
  scheme?: string;
}

type SqlJsDatabase = import('sql.js').Database;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require('sql.js') as typeof import('sql.js').default;

export class MbtilesReader {
  private db: SqlJsDatabase | null = null;
  private metadata: MbtilesMetadata = {};
  private scheme: 'xyz' | 'tms' = 'xyz';

  constructor(private readonly filePath: string) {}

  async open(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`MBTiles file not found: ${this.filePath}`);
    }
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(this.filePath);
    this.db = new SQL.Database(buffer);
    this.metadata = this.readMetadata();
    this.scheme = this.metadata.scheme === 'tms' ? 'tms' : 'xyz';
    logger.main.info(`MBTiles opened: ${path.basename(this.filePath)}`);
  }

  private readMetadata(): MbtilesMetadata {
    if (!this.db) return {};
    const meta: MbtilesMetadata = {};
    const results = this.db.exec('SELECT name, value FROM metadata');
    const rows = results[0]?.values ?? [];
    for (const row of rows) {
      const name = row[0] as string;
      const value = row[1] as string;
      if (name) (meta as Record<string, string>)[name] = value;
    }
    return meta;
  }

  getMetadata(): MbtilesMetadata {
    return { ...this.metadata };
  }

  getTile(z: number, x: number, y: number): Buffer | null {
    if (!this.db) return null;
    let tileRow = y;
    if (this.scheme === 'xyz') {
      tileRow = (1 << z) - 1 - y;
    }
    const stmt = this.db.prepare(
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
    );
    stmt.bind([z, x, tileRow]);
    let data: Buffer | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { tile_data: Uint8Array };
      if (row.tile_data) data = Buffer.from(row.tile_data);
    }
    stmt.free();
    return data;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
