/**
 * Readable names for CIFP approach identifiers.
 *
 * The nav data names an approach by a compact ARINC 424 identifier: a type letter, the runway and
 * an optional variant letter, e.g. `I04LZ` (ILS Z RWY 04L), `R29-T` (RNAV (GPS) T RWY 29), or a
 * runway-less circling form such as `VORA` (VOR-A). The approach records also carry a route-type
 * letter; it is the authoritative type and differs from the identifier's first letter for the
 * circling `C...` names and a few others (an `L` identifier flown as an LDA, a `V` with DME).
 */

/** ARINC 424 approach route types, as written on charts. */
const TYPE_NAMES: Readonly<Record<string, string>> = {
  B: 'LOC BC',
  D: 'VOR/DME',
  F: 'FMS',
  G: 'IGS',
  H: 'RNAV (RNP)',
  I: 'ILS',
  J: 'GLS',
  L: 'LOC',
  M: 'MLS',
  N: 'NDB',
  P: 'GPS',
  Q: 'NDB/DME',
  R: 'RNAV (GPS)',
  S: 'VOR/DME',
  T: 'TACAN',
  U: 'SDF',
  V: 'VOR',
  W: 'MLS',
  X: 'LDA',
  Y: 'MLS',
};

/** Three-letter type codes used by the runway-less (circling) identifiers. */
const CIRCLING_CODES: Readonly<Record<string, string>> = {
  VOR: 'VOR',
  RNV: 'RNAV (GPS)',
  NDB: 'NDB',
  VDM: 'VOR/DME',
  NDM: 'NDB/DME',
  LDM: 'LOC/DME',
  LOC: 'LOC',
  GPS: 'GPS',
  LDA: 'LDA',
  LBC: 'LOC BC',
  ILS: 'ILS',
  TCN: 'TACAN',
};

/** Type letter, two-digit runway, optional side (T is a true-heading runway), optional variant. */
const RUNWAY_FORM = /^([A-Z])(\d{2})([LRCT]?)-?([A-Z0-9]?)$/;
/** Three-letter code plus optional variant (`VORA`, `NDB1`), or a `C`-prefixed circling code. */
const CIRCLING_FORM = /^([A-Z]{3})([A-Z0-9]?)$/;

/**
 * The chart-style name for an approach identifier, e.g. `ILS Z RWY 04L`. Returns the identifier
 * unchanged when it does not follow either known form, so nothing is ever hidden.
 */
export function formatApproachName(identifier: string, routeType?: string | null): string {
  const id = identifier.trim().toUpperCase();
  const typeFromRecord = routeType ? TYPE_NAMES[routeType.trim().toUpperCase()] : undefined;

  const runway = RUNWAY_FORM.exec(id);
  if (runway) {
    const [, letter, digits, side, variant] = runway;
    const type = typeFromRecord ?? TYPE_NAMES[letter!];
    if (!type) return identifier;
    return `${type}${variant ? ` ${variant}` : ''} RWY ${digits}${side}`;
  }

  const circling = CIRCLING_FORM.exec(id);
  if (circling) {
    const [, code, variant] = circling;
    if (code!.startsWith('C') && !CIRCLING_CODES[code!]) {
      // `CNDB`, `CVOR`...: the type is in the record, the tail of the name is the rest of the code.
      return typeFromRecord ?? identifier;
    }
    const type = CIRCLING_CODES[code!];
    if (!type) return identifier;
    return variant ? `${type}-${variant}` : type;
  }

  return identifier;
}
