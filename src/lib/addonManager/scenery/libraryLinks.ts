/**
 * Where to get a scenery library the user is missing. A few have a known home;
 * everything else gets an X-Plane.org download search for its exact name, which
 * is how pilots find them anyway. Pure data, used by both processes.
 */
export interface LibraryLink {
  /** The library's display name. */
  name: string;
  url: string;
  /** False when the link is a search rather than the library's own page. */
  known: boolean;
}

interface KnownLibrary {
  name: string;
  url: string;
  /** Lower-cased folder or namespace names a DSF may use for it. */
  aliases: string[];
}

/** Add an entry when the home page is certain; a wrong link is worse than a search. */
const KNOWN_LIBRARIES: KnownLibrary[] = [
  {
    name: 'MisterX Library',
    url: 'https://forums.x-plane.org/files/file/28167-misterx-library-and-static-aircraft-extension/',
    aliases: ['misterx_library', 'misterx'],
  },
  {
    name: 'OpenSceneryX',
    url: 'https://www.opensceneryx.com/',
    aliases: ['opensceneryx'],
  },
  {
    name: 'openSAM',
    url: 'https://github.com/hotbso/openSAM/releases',
    aliases: ['opensam_library', 'opensam'],
  },
  {
    name: 'CDB Library',
    url: 'https://forums.x-plane.org/files/file/27907-cdb-library/',
    aliases: ['cdb-library', 'cdb_library', 'cdb'],
  },
  {
    name: 'RA Library',
    url: 'https://forums.x-plane.org/files/file/45410-ra-library/',
    aliases: ['ra_library', 'ra'],
  },
  {
    name: 'The Handy Objects Library',
    url: 'https://forums.x-plane.org/files/file/24261-the-handy-objects-library/',
    aliases: ['the_handy_objects_library', 'the handy objects library', 'handy_objects', 'handy'],
  },
  {
    name: 'The FAIB Aircraft Library',
    url: 'https://forums.x-plane.org/files/file/29079-the-faib-aircraft-library/',
    aliases: ['the-faib aircraft library', 'faib_aircraft_library', 'faib'],
  },
  {
    name: 'FlyBy Planes Library',
    url: 'https://forums.x-plane.org/files/file/28295-flyby-planes-library/',
    aliases: ['flyby planes library', 'flyby_planes_library', 'flyby'],
  },
  {
    name: 'ALES Developer Library',
    url: 'https://forums.x-plane.org/files/file/53427-ales-developer-library/',
    aliases: ['ales_dev_lib', 'ales_developer_library', 'ales'],
  },
  {
    name: 'Waves Library',
    url: 'https://forums.x-plane.org/files/file/25439-waves-library/',
    aliases: ['waves_library', 'waves'],
  },
  {
    name: 'RE_Library',
    url: 'https://forums.x-plane.org/files/file/24722-re_library-airport-buildings-and-related-objects/',
    aliases: ['re_library'],
  },
  {
    name: 'Pavement Paintings Library',
    url: 'https://forums.x-plane.org/files/file/37088-pavement-paintings-library-pplibrary/',
    aliases: ['pplibrary', 'pp_library', 'pavement_paintings_library'],
  },
  {
    name: 'The Fruit Stand Aircraft Library',
    url: 'https://forums.x-plane.org/files/file/27545-the-fruit-stand-aircraft-library/',
    aliases: [
      'the-fruit-stand aircraft library',
      'the_fruit_stand_aircraft_library',
      'fruit-stand',
      'tfs',
    ],
  },
  {
    name: 'Flags of the World',
    url: 'https://forums.x-plane.org/files/file/17090-flags-of-the-world-real-flag-ii/',
    aliases: ['flags_of_the_world', 'flags'],
  },
  {
    name: 'FJS Scenery Library',
    url: 'https://forums.x-plane.org/files/file/28594-fjs_scenery_library/',
    aliases: ['fjs_scenery_library', 'fjs'],
  },
  {
    name: 'PM_Library',
    url: 'https://forums.x-plane.org/files/file/29185-pm_library-objects-for-scenery/',
    aliases: ['pm_library'],
  },
  {
    name: 'XAirportScenery',
    url: 'https://forums.x-plane.org/files/file/17534-xairportscenery/',
    aliases: ['xairportscenery'],
  },
  {
    name: 'FF Library',
    url: 'https://forums.x-plane.org/files/file/12708-fflibrary/',
    aliases: ['ff_library', 'fflibrary'],
  },
  {
    name: 'FF Library (extended LOD)',
    url: 'https://forums.x-plane.org/files/file/12836-ff-library-extended-lod-version/',
    aliases: ['ff_library_extended_lod', 'ff_library_extended'],
  },
  {
    name: 'Amazing 3D Overlays HD (W2XP)',
    url: 'https://forums.x-plane.org/files/file/40408-amazing-3d-overlays-hd-by-country-w2xp/',
    aliases: ['amazing_3d_overlays', 'w2xp_amazing_3d_overlays'],
  },
];

const BY_ALIAS = new Map<string, KnownLibrary>();
for (const library of KNOWN_LIBRARIES) {
  for (const alias of library.aliases) BY_ALIAS.set(alias, library);
}

/** The X-Plane.org file search for a library name. */
export function librarySearchUrl(library: string): string {
  return `https://forums.x-plane.org/index.php?/search/&q=${encodeURIComponent(library)}&type=downloads_file`;
}

export function libraryLink(library: string): LibraryLink {
  const known = BY_ALIAS.get(library.toLowerCase());
  if (known) return { name: known.name, url: known.url, known: true };
  return { name: library, url: librarySearchUrl(library), known: false };
}
