/**
 * Navdata layout and provider detection.
 *
 * Navdata ships in several shapes that all look alike from the outside: the
 * X-Plane native set, the GNS430 subset, a bare CIFP drop, and aircraft
 * specific packages. They install into different folders, so the layout has to
 * be read from the archive listing before anything is written.
 */
import * as path from 'path';
import type { ArchiveEntry, NavdataInfo } from '../types';

/** Folder under Custom Data the package belongs in, relative to X-Plane. */
export type NavdataLayout = 'xplane' | 'gns430' | 'cifp' | 'ff777';

export interface NavdataDetection {
  layout: NavdataLayout;
  /** Path segments under Custom Data, empty for the X-Plane native set */
  subPath: string[];
  info: NavdataInfo;
}

const XPLANE_DATA_FILES = [
  'earth_nav.dat',
  'earth_fix.dat',
  'earth_awy.dat',
  'earth_hold.dat',
  'earth_mora.dat',
  'earth_msa.dat',
];

const PROVIDERS: { token: string; name: string }[] = [
  { token: 'navigraph', name: 'Navigraph' },
  { token: 'navdatapro', name: 'Aerosoft NavDataPro' },
  { token: 'aerosoft', name: 'Aerosoft NavDataPro' },
  { token: 'aerosim', name: 'Aerosim' },
];

/**
 * AIRAC cycles are four digits: two for the year, two for the cycle.
 */
function findCycle(text: string): string {
  const match = /(?:^|[^0-9])(\d{2}(?:0[1-9]|1[0-3]))(?:[^0-9]|$)/.exec(text);
  return match?.[1] ?? '';
}

function findProvider(text: string): string {
  const lower = text.toLowerCase();
  for (const provider of PROVIDERS) {
    if (lower.includes(provider.token)) return provider.name;
  }
  return '';
}

/**
 * Work out where a navdata package installs and who produced it.
 * `internalRoot` is the folder inside the archive holding cycle.json.
 */
export function detectNavdata(
  archivePath: string,
  entries: ArchiveEntry[],
  internalRoot: string
): NavdataDetection {
  const relative = entries
    .filter((e) => !e.isDirectory)
    .map((e) => e.path.replace(/\\/g, '/'))
    .filter((p) => (internalRoot ? p.startsWith(internalRoot) : true))
    .map((p) => (internalRoot ? p.slice(internalRoot.length) : p));

  const lowerPaths = relative.map((p) => p.toLowerCase());
  const archiveName = path.basename(archivePath);
  const searchText = `${archiveName} ${internalRoot}`;

  const provider = findProvider(`${searchText} ${lowerPaths.join(' ')}`);
  const cycle = findCycle(archiveName) || findCycle(internalRoot);

  const has = (name: string) => lowerPaths.some((p) => path.basename(p) === name);
  const hasSegment = (segment: string) =>
    lowerPaths.some((p) => p.split('/').includes(segment)) ||
    internalRoot.toLowerCase().split('/').includes(segment) ||
    archiveName.toLowerCase().includes(segment);

  let layout: NavdataLayout = 'xplane';
  let subPath: string[] = [];

  if (hasSegment('gns430')) {
    layout = 'gns430';
    subPath = ['GNS430'];
  } else if (lowerPaths.some((p) => p.includes('ndbl/data')) || hasSegment('stsff')) {
    layout = 'ff777';
    subPath = ['STSFF', 'nav-data', 'ndbl', 'data'];
  } else if (XPLANE_DATA_FILES.some((f) => has(f))) {
    layout = 'xplane';
    subPath = [];
  } else if (lowerPaths.every((p) => p === 'cycle.json' || p.startsWith('cifp/'))) {
    layout = 'cifp';
    subPath = ['CIFP'];
  }

  const name = [provider, layout === 'gns430' ? 'GNS430' : ''].filter(Boolean).join(' ').trim();

  return {
    layout,
    subPath,
    info: {
      name: name || 'Navdata',
      cycle,
      ...(provider ? { revision: provider } : {}),
    },
  };
}
