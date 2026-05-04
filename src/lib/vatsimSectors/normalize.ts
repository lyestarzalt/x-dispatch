import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type {
  VatsimFirFeature,
  VatsimSectorDataset,
  VatsimTraconFeature,
} from '@/types/vatsimSectors';

type BoundaryCollection = FeatureCollection<
  Polygon | MultiPolygon,
  { id: string; oceanic: string; label_lon: string; label_lat: string }
>;

type SimawareCollection = FeatureCollection<
  Polygon | MultiPolygon,
  {
    id: string;
    prefix?: string[];
    suffix?: string;
    name: string;
    label_lat?: number;
    label_lon?: number;
  }
>;

function parseDatSection(dat: string, title: string): string[][] {
  const block = dat.split(`[${title}]`)[1]?.split(/\n\s*\n/)[0];
  if (!block) {
    return [];
  }

  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(';'))
    .map((line) =>
      line
        .split('|')
        .map((part) => part.split(';')[0]?.trim() ?? '')
        .filter(Boolean)
    );
}

export function normalizeVatspyData(
  _version: string,
  datText: string,
  boundariesText: string
): VatsimFirFeature[] {
  const firRows = parseDatSection(datText, 'FIRs');
  const boundaries = JSON.parse(boundariesText) as BoundaryCollection;

  const boundaryById = new Map(
    boundaries.features.map((feature) => [
      feature.properties.id,
      {
        geometry: feature.geometry,
        boundaryId: feature.properties.id,
        label: [Number(feature.properties.label_lon), Number(feature.properties.label_lat)] as [
          number,
          number,
        ],
        oceanic: feature.properties.oceanic === '1',
      },
    ])
  );

  return firRows
    .map<VatsimFirFeature | null>((parts) => {
      const [icao, name, callsign, boundary] = parts;
      if (!icao || !name) {
        return null;
      }

      const joined = boundaryById.get(boundary || icao);
      if (!joined) {
        return null;
      }

      return {
        id: joined.boundaryId,
        icao,
        name,
        callsign: callsign || undefined,
        boundaryId: joined.boundaryId,
        geometry: joined.geometry,
        label: joined.label,
        oceanic: joined.oceanic,
      } satisfies VatsimFirFeature;
    })
    .filter((value): value is VatsimFirFeature => value !== null);
}

export function normalizeSimawareData(
  _version: string,
  raw: SimawareCollection
): VatsimTraconFeature[] {
  return raw.features
    .map((feature) => {
      const prefixes = Array.isArray(feature.properties.prefix) ? feature.properties.prefix : [];

      return {
        id: feature.properties.id,
        name: feature.properties.name,
        prefixes,
        suffix: feature.properties.suffix || undefined,
        geometry: feature.geometry,
        label:
          typeof feature.properties.label_lon === 'number' &&
          typeof feature.properties.label_lat === 'number'
            ? ([feature.properties.label_lon, feature.properties.label_lat] as [number, number])
            : undefined,
      } satisfies VatsimTraconFeature;
    })
    .filter((feature) => feature.prefixes.length > 0)
    .sort((a, b) => {
      if (a.suffix && !b.suffix) return -1;
      if (!a.suffix && b.suffix) return 1;
      return 0;
    });
}

export function buildSectorDataset(args: {
  vatspyVersion: string;
  simawareVersion: string;
  dat: string;
  boundariesText: string;
  simaware: SimawareCollection;
  builtAt: string;
}): VatsimSectorDataset {
  return {
    version: {
      vatspy: args.vatspyVersion,
      simaware: args.simawareVersion,
      builtAt: args.builtAt,
    },
    firs: normalizeVatspyData(args.vatspyVersion, args.dat, args.boundariesText),
    tracons: normalizeSimawareData(args.simawareVersion, args.simaware),
  };
}
