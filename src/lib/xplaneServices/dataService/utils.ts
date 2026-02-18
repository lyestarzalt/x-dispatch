/**
 * X-Plane Data Service Utilities
 * Shared utilities for data loading and geo operations
 */
import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Fast async file reader for large files
 * Uses Node.js streams to efficiently read large apt.dat files line-by-line
 */
export class FastFileReader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async *readLines(): AsyncGenerator<{ line: string; position: number }> {
    const fileStream = fs.createReadStream(this.filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let position = 0;
    for await (const line of rl) {
      position += Buffer.byteLength(line, 'utf-8') + 1; // +1 for newline
      yield { line, position };
    }
  }
}

/**
 * Quick bounding box check for geo filtering
 * Performs a fast rectangular check before expensive distance calculations
 */
export function isInBoundingBox(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusNm: number
): boolean {
  const degPerNm = 1 / 60;
  const latRange = radiusNm * degPerNm;
  const lonRange = (radiusNm * degPerNm) / Math.cos((centerLat * Math.PI) / 180);
  return (
    lat >= centerLat - latRange &&
    lat <= centerLat + latRange &&
    lon >= centerLon - lonRange &&
    lon <= centerLon + lonRange
  );
}
