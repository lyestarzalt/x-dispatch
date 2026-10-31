/**
 * A byte-split zip (`pack.zip.001`, `.002`, ...) read as one file, without
 * joining the volumes on disk: yauzl asks for byte ranges, and each range is
 * served from whichever volumes it spans.
 */
import * as fs from 'fs';
import { PassThrough } from 'stream';
import type { Readable } from 'stream';
import * as yauzl from 'yauzl';

interface Volume {
  path: string;
  /** Offset of the volume's first byte in the joined file. */
  start: number;
  /** Offset just past the volume's last byte. */
  end: number;
}

export class MultiVolumeReader extends yauzl.RandomAccessReader {
  private constructor(
    private readonly volumes: Volume[],
    readonly totalSize: number
  ) {
    super();
  }

  static async open(paths: string[]): Promise<MultiVolumeReader> {
    const volumes: Volume[] = [];
    let offset = 0;
    for (const volumePath of paths) {
      const { size } = await fs.promises.stat(volumePath);
      volumes.push({ path: volumePath, start: offset, end: offset + size });
      offset += size;
    }
    return new MultiVolumeReader(volumes, offset);
  }

  _readStreamForRange(start: number, end: number): Readable {
    const out = new PassThrough();
    const parts = this.volumes.filter((v) => v.end > start && v.start < end);

    const pump = async () => {
      for (const volume of parts) {
        const from = Math.max(start, volume.start) - volume.start;
        const to = Math.min(end, volume.end) - volume.start;
        await new Promise<void>((resolve, reject) => {
          const input = fs.createReadStream(volume.path, { start: from, end: to - 1 });
          input.on('error', reject);
          input.on('end', resolve);
          input.pipe(out, { end: false });
        });
      }
      out.end();
    };

    pump().catch((err: Error) => out.destroy(err));
    return out;
  }
}

type OpenCallback = (err: Error | null, zipFile?: yauzl.ZipFile) => void;

/** Open a zip by its volumes: one file through yauzl.open, several through the reader. */
export function openZipFile(
  volumes: string[],
  options: yauzl.Options,
  callback: OpenCallback
): void {
  const first = volumes[0];
  if (!first) {
    callback(new Error('No archive to open'));
    return;
  }
  if (volumes.length === 1) {
    yauzl.open(first, options, callback);
    return;
  }
  MultiVolumeReader.open(volumes)
    .then((reader) => yauzl.fromRandomAccessReader(reader, reader.totalSize, options, callback))
    .catch((err: Error) => callback(err));
}
