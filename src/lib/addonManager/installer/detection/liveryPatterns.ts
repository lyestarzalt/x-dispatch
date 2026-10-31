/**
 * Livery detection: a livery archive has no .acf, so the aircraft is read from what
 * the painter shipped. Two kinds of clue: a texture or folder only that aircraft
 * uses, and the icon X-Plane writes next to every livery, which is named after the
 * .acf (`b738_icon11.png`). The icon rule covers any aircraft; the table makes the
 * popular ones read as a name rather than an .acf stem.
 */

interface LiveryRule {
  /** `path`: the folder path occurs anywhere; `file`: the file name (with optional dirs) matches. */
  kind: 'path' | 'file';
  /** Lower-case; `*` matches within a path segment, `?` one optional character. */
  pattern: string;
}

interface LiveryPattern {
  aircraftTypeId: string;
  aircraftName: string;
  rules: LiveryRule[];
  /** Globs the installed aircraft's .acf stem must match. */
  acfIdentifiers: string[];
}

export interface LiveryMatch {
  aircraftTypeId: string;
  aircraftName: string;
  /** Folder the livery lives in, with a trailing slash, or '' at the archive root. */
  root: string;
}

const file = (pattern: string): LiveryRule => ({ kind: 'file', pattern });
const dir = (pattern: string): LiveryRule => ({ kind: 'path', pattern });

/** Our own table; add an aircraft by naming a file only its liveries contain. */
const LIVERY_PATTERNS: LiveryPattern[] = [
  {
    aircraftTypeId: 'FF_B777',
    aircraftName: 'FlightFactor 777v2',
    rules: [dir('objects/777')],
    acfIdentifiers: ['777-200*', '777-300*', '777-F*'],
  },
  {
    aircraftTypeId: 'TOLISS_A319',
    aircraftName: 'ToLiss A319',
    rules: [
      file('a319_*icon11*.png'),
      file('objects/fuselage319*.png'),
      file('objects/fuselage319*.dds'),
    ],
    acfIdentifiers: ['a319*'],
  },
  {
    aircraftTypeId: 'TOLISS_A320',
    aircraftName: 'ToLiss A320',
    rules: [
      file('a320_*icon11*.png'),
      file('objects/fuselage320*.png'),
      file('objects/fuselage320*.dds'),
    ],
    acfIdentifiers: ['a320*'],
  },
  {
    aircraftTypeId: 'TOLISS_A321',
    aircraftName: 'ToLiss A321',
    rules: [
      file('a321_*icon11*.png'),
      file('objects/fuselage321*.png'),
      file('objects/fuselage321*.dds'),
    ],
    acfIdentifiers: ['a321*'],
  },
  {
    aircraftTypeId: 'TOLISS_A339',
    aircraftName: 'ToLiss A339',
    rules: [
      file('a330-900_*icon11*.png'),
      file('objects/a339_engines.png'),
      file('objects/a339_engines.dds'),
    ],
    acfIdentifiers: ['a330-900*'],
  },
  {
    aircraftTypeId: 'TOLISS_A346',
    aircraftName: 'ToLiss A346',
    rules: [
      file('a340-600_*icon11*.png'),
      file('objects/enginea346*.png'),
      file('objects/enginea346*.dds'),
    ],
    acfIdentifiers: ['a340-600*'],
  },
  {
    aircraftTypeId: 'ZIBO_B738',
    aircraftName: 'Zibo 737-800',
    rules: [file('b738_*icon11*.png'), file('objects/738*.png')],
    acfIdentifiers: ['b738', 'b738_*'],
  },
  {
    aircraftTypeId: 'LEVELUP_B737',
    aircraftName: 'LevelUp 737NG',
    rules: [
      file('737_??ng_icon11*.png'),
      file('objects/737_??ng/737_*ng*.png'),
      file('objects/737_??ng/737_*ng*.dds'),
    ],
    acfIdentifiers: ['737_??ng'],
  },
  {
    aircraftTypeId: 'XCRAFTS_E170',
    aircraftName: 'X-Crafts E170',
    rules: [file('e170_*icon11*.png'), dir('objects/e170')],
    acfIdentifiers: ['e170*'],
  },
  {
    aircraftTypeId: 'XCRAFTS_E175',
    aircraftName: 'X-Crafts E175',
    rules: [file('e175_*icon11*.png'), dir('objects/e175')],
    acfIdentifiers: ['e175*'],
  },
  {
    aircraftTypeId: 'XCRAFTS_E190',
    aircraftName: 'X-Crafts E190',
    rules: [file('e190_*icon11*.png'), dir('objects/e190')],
    acfIdentifiers: ['e190*'],
  },
  {
    aircraftTypeId: 'XCRAFTS_E195',
    aircraftName: 'X-Crafts E195',
    rules: [file('e195_*icon11*.png'), dir('objects/e195')],
    acfIdentifiers: ['e195*'],
  },
  {
    aircraftTypeId: 'XCRAFTS_LINEAGE',
    aircraftName: 'X-Crafts Lineage 1000',
    rules: [file('lineage_*icon11*.png'), dir('objects/lineage')],
    acfIdentifiers: ['lineage*'],
  },
  {
    aircraftTypeId: 'FELIS_B742',
    aircraftName: 'Felis 747-200',
    rules: [
      file('b742_pw_felis_*icon11*.png'),
      file('objects/fuselage_main.png'),
      file('objects/fuselage_main.dds'),
    ],
    acfIdentifiers: ['b742_pw_felis*'],
  },
  {
    aircraftTypeId: 'FELIS_B742F',
    aircraftName: 'Felis 747-200F',
    rules: [
      file('b742_cargo_felis_*icon11*.png'),
      file('objects/fuselage_cargo.png'),
      file('objects/fuselage_cargo.dds'),
    ],
    acfIdentifiers: ['b742_ge_felis*'],
  },
  {
    aircraftTypeId: 'ROTATE_MD11',
    aircraftName: 'Rotate MD-11',
    rules: [file('rotate-md-11_icon11*.png'), file('objects/md-11-exterior-*.png')],
    acfIdentifiers: ['rotate-md-11*'],
  },
];

/** `<acf stem>_icon11.png` / `_icon11_thumb.png`: the icon X-Plane writes for every livery. */
const ICON_RULE = /^(.+?)_icon11(?:_thumb)?\.png$/i;

const GENERIC_PREFIX = 'acf:';

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .split('')
    .map((c) => {
      if (c === '*') return '[^/]*';
      if (c === '?') return '[^/]?';
      return c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${escaped}$`, 'i');
}

const ruleCache = new Map<string, RegExp>();
function ruleRegExp(pattern: string): RegExp {
  let re = ruleCache.get(pattern);
  if (!re) {
    re = globToRegExp(pattern);
    ruleCache.set(pattern, re);
  }
  return re;
}

/** The folder above `depth` trailing segments of `segments`, with a trailing slash. */
function rootAbove(segments: string[], depth: number): string {
  const kept = segments.slice(0, Math.max(0, segments.length - depth));
  return kept.length ? kept.join('/') + '/' : '';
}

function matchRule(rule: LiveryRule, normalized: string, lower: string): string | null {
  const segments = normalized.split('/');
  if (rule.kind === 'path') {
    const needle = rule.pattern;
    const idx =
      lower.indexOf(`/${needle}/`) >= 0
        ? lower.indexOf(`/${needle}/`) + 1
        : lower.startsWith(`${needle}/`)
          ? 0
          : -1;
    if (idx < 0) return null;
    return idx === 0 ? '' : normalized.slice(0, idx);
  }
  const patternSegments = rule.pattern.split('/');
  if (patternSegments.length > segments.length) return null;
  const tail = segments.slice(segments.length - patternSegments.length);
  const matches = patternSegments.every((p, i) => ruleRegExp(p).test(tail[i] ?? ''));
  if (!matches) return null;
  return rootAbove(segments, patternSegments.length);
}

/** Does this archive entry mark a livery, and for which aircraft. */
export function matchLivery(entryPath: string): LiveryMatch | null {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const lower = normalized.toLowerCase();

  for (const pattern of LIVERY_PATTERNS) {
    for (const rule of pattern.rules) {
      const root = matchRule(rule, normalized, lower);
      if (root !== null) {
        return { aircraftTypeId: pattern.aircraftTypeId, aircraftName: pattern.aircraftName, root };
      }
    }
  }

  const segments = normalized.split('/');
  const name = segments[segments.length - 1] ?? '';
  const icon = ICON_RULE.exec(name);
  if (icon && icon[1]) {
    const stem = icon[1];
    return {
      aircraftTypeId: `${GENERIC_PREFIX}${stem}`,
      aircraftName: stem,
      root: rootAbove(segments, 1),
    };
  }

  return null;
}

/** A test for the installed aircraft's .acf stem, from a livery's aircraft id. */
export function liveryAcfMatcher(aircraftTypeId: string): (acfStem: string) => boolean {
  if (aircraftTypeId.startsWith(GENERIC_PREFIX)) {
    const stem = aircraftTypeId.slice(GENERIC_PREFIX.length).toLowerCase();
    return (acfStem) => acfStem.toLowerCase() === stem;
  }
  const pattern = LIVERY_PATTERNS.find((p) => p.aircraftTypeId === aircraftTypeId);
  if (!pattern) return () => false;
  const tests = pattern.acfIdentifiers.map(ruleRegExp);
  return (acfStem) => tests.some((re) => re.test(acfStem));
}
