/** Readings off an ATIS broadcast's text, the same for both networks. */

const NATO: Record<string, string> = {
  ALPHA: 'A',
  ALFA: 'A',
  BRAVO: 'B',
  CHARLIE: 'C',
  DELTA: 'D',
  ECHO: 'E',
  FOXTROT: 'F',
  GOLF: 'G',
  HOTEL: 'H',
  INDIA: 'I',
  JULIET: 'J',
  JULIETT: 'J',
  KILO: 'K',
  LIMA: 'L',
  MIKE: 'M',
  NOVEMBER: 'N',
  OSCAR: 'O',
  PAPA: 'P',
  QUEBEC: 'Q',
  ROMEO: 'R',
  SIERRA: 'S',
  TANGO: 'T',
  UNIFORM: 'U',
  VICTOR: 'V',
  WHISKEY: 'W',
  XRAY: 'X',
  YANKEE: 'Y',
  ZULU: 'Z',
};

/** "INFORMATION K", "INFO K", "ATIS K" and the spelled "INFORMATION KILO" → "K". */
export function atisLetterFromText(lines: string[]): string | null {
  const text = lines.join(' ').toUpperCase();
  const m =
    text.match(/\bINFO(?:RMATION)?\s+([A-Z])\b/) ??
    text.match(/\bATIS\s+(?:INFO\s+)?([A-Z])\b/) ??
    text.match(/\bINFO(?:RMATION)?\s+([A-Z]{4,8})\b/);
  const found = m?.[1];
  if (!found) return null;
  return found.length === 1 ? found : (NATO[found] ?? null);
}

/** IVAO's first ATIS line is the voice server address, not part of the broadcast. */
export function broadcastLines(lines: string[]): string[] {
  return lines.filter((l) => !/^[\w.-]+\.ivao\.aero\//i.test(l.trim()));
}

/** Which way a runway is used, as far as the broadcast says. */
export type RunwayUse = 'arrival' | 'departure';

/** The runways a broadcast names, split by use. A runway named with no use is in both lists. */
export interface AtisRunwayUse {
  arrivals: string[];
  departures: string[];
  /** Every runway in use, in the order the broadcast names them. */
  all: string[];
}

// "25L", "07", "34 R", and the spelled "33 LEFT" some airports broadcast.
const RUNWAY_END = '\\d{1,2}(?:\\s?[LRC](?![A-Z])|\\s+(?:LEFT|RIGHT|CENT(?:ER|RE))\\b)?(?!\\d)';
// "RWYS 22L, 22R" lists with commas; after a single "RWY 27" a comma starts something else
// ("RWY 27, 10 KT"), so only "AND", "&" and "/" carry the list on. A bare space does too
// or a comma when the next end has its side letter ("RWY 24R 24L", "RWY 13L, 13R").
const runwayList = (separator: string) =>
  `\\s*(?:IN USE\\s*)?(${RUNWAY_END}(?:(?:\\s*(?:${separator})\\s*${RUNWAY_END})|(?:\\s*,?\\s+\\d{1,2}[LRC](?![\\dA-Z])))*)`;
const RUNWAY_GROUP = `\\bR(?:WYS|UNWAYS)${runwayList(',|AND|&|/')}|\\bR(?:WY|Y|UNWAY)${runwayList('AND|&|/')}`;
const ARRIVAL_WORD =
  'ARR(?:S|G|IVALS?|IVING)?|LANDINGS?|LAND|LNDG?|LDG|APCH(?:S|ES)?|APPR|APPROACH(?:ES)?|ILS|RNAV|RNP|VISUAL';
const DEPARTURE_WORD = 'DEP(?:S|G|TG|ART|ARTS|ARTURES?|ARTING)?|TAKE-?\\s?OFFS?|TKOFF?';
// A use word with the runway straight after it and no "RWY": "LDG 15 TKOF 23", "FOR DEP 24R".
const BARE_END = '(?:\\d{2}[LRC]?|\\d[LRC])(?![\\dA-Z]|\\.\\d)';
const BARE_ENDS = `(?:\\s+(?<bare>${BARE_END}(?:\\s*(?:AND|&|/)\\s*${BARE_END})*))?`;
const SCAN = new RegExp(
  `${RUNWAY_GROUP}|\\b(?:(?<arr>${ARRIVAL_WORD})|(?<dep>${DEPARTURE_WORD}))\\b${BARE_ENDS}|(?<stop>\\.(?=\\s|$))`,
  'g'
);
// What may follow a runway: "RWY 25R FOR LANDING", "RWY 13R CLSD", "RWY 1C AVBL UPON REQUEST".
// "RWY 16L ILS X" gives the approach after the runway.
const AFTER_USE = new RegExp(
  `^\\s*(?:(?:IN USE\\s*)?FOR\\s+(?:(${ARRIVAL_WORD})|(${DEPARTURE_WORD}))|(ILS|RNAV|RNP|LOC|VOR))\\b`
);
// "RWY 04 COND REP", "RUNWAY 27 SURFACE CONDITION" report the surface, not the use.
const AFTER_NOT_IN_USE =
  /^\s*(?:IS\s+|ARE\s+)?(?:CLSD|CLOSED|AVBL|AVAILABLE|COND(?:ITION)?S?|SURFACE)\b/;
// The NOTAM part names runways for lights and closures, not for use. Plural only: "AS PER
// NOTAM A 1077" sits in the middle of a departure line.
const NOTAMS = /\bNOTAMS\b|\bNOTICE TO AIR\s?(?:MEN|MISSIONS)\b/;
// "RWY 22 IN USE", "RWY IN USE 22": in use, whichever way.
const IN_USE = /^\s*(?:IS\s+|ARE\s+)?IN USE\b/;
// After "RWYS", the list can carry where to enter each one: "RWYS 9C FROM F, 10L FROM DD",
// "RWYS 1R FULL LENGTH AND 1L AT BRAVO". It runs to the end of the sentence or the next
// runway or use word, and only ends with a side letter are taken from it.
const LIST_END = new RegExp(
  `\\.(?=\\s|$)|\\bR(?:WYS?|Y|UNWAYS?)\\b|\\b(?:${ARRIVAL_WORD}|${DEPARTURE_WORD})\\b`
);
const SIDED_END = /\b\d{1,2}[LRC]\b/g;
// A use word counts for the runways that follow it closely: "DEPG RWY 4L, RWY 31L".
const USE_REACH = 40;
const SIDE: Record<string, string> = { LEFT: 'L', RIGHT: 'R', CENTER: 'C', CENTRE: 'C' };

/** "33 LEFT" → "33L"; null for a number that is no runway heading. */
function runwayEnd(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})\s*([A-Z]+)?$/);
  if (!m?.[1]) return null;
  const heading = parseInt(m[1], 10);
  if (heading < 1 || heading > 36) return null;
  const side = m[2] ? (SIDE[m[2]] ?? m[2]) : '';
  return `${m[1]}${side}`;
}

/**
 * Reads which runways a broadcast gives for landing and which for takeoff:
 * "ILS RWY 4R APCH IN USE. DEPG RWY 4L", "ARR RWY 27R DEP RWY 27L",
 * "RWY 25R FOR LANDING". A runway said to be "IN USE" with no use counts both
 * ways. Once a broadcast states any of that, runways it only names are remarks
 * ("USE CAUTION EXITING RWY 24R") and are left out; when it states nothing,
 * every runway named is in use both ways. `only` is for an
 * airport with separate arrival and departure ATIS, where the station says
 * the use and the text may not.
 */
export function atisRunwayUse(lines: string[], only: RunwayUse | null = null): AtisRunwayUse {
  const whole = lines.join(' ').toUpperCase();
  const notams = whole.search(NOTAMS);
  const text = notams === -1 ? whole : whole.slice(0, notams);
  const arrivals: string[] = [];
  const departures: string[] = [];
  const unstated: string[] = [];
  let arr = false;
  let dep = false;
  let reach = -1; // where the current use words stop counting
  let used = false; // a runway already took the current use words
  let skipUntil = 0;

  SCAN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCAN.exec(text)) !== null) {
    if (m.index < skipUntil) continue;
    if (m.groups?.stop) {
      arr = dep = false;
      continue;
    }
    if (m.groups?.arr || m.groups?.dep) {
      if (used || m.index > reach) arr = dep = used = false;
      if (m.groups.arr) arr = true;
      else dep = true;
      reach = SCAN.lastIndex + USE_REACH;
      for (const item of m.groups.bare?.match(new RegExp(BARE_END, 'g')) ?? []) {
        const end = runwayEnd(item);
        if (!end) continue;
        (m.groups.arr ? arrivals : departures).push(end);
        used = true;
      }
      continue;
    }

    const after = text.slice(SCAN.lastIndex);
    if (AFTER_NOT_IN_USE.test(after)) continue;
    const inReach = m.index <= reach;
    let isArr = inReach && arr;
    let isDep = inReach && dep;
    const stated = AFTER_USE.exec(after);
    if (stated) {
      isArr = stated[2] === undefined;
      isDep = !isArr;
      skipUntil = SCAN.lastIndex + stated[0].length;
    } else if (inReach) {
      used = true;
      reach = SCAN.lastIndex + USE_REACH;
    }
    const raw: string[] = [...((m[1] ?? m[2] ?? '').match(new RegExp(RUNWAY_END, 'g')) ?? [])];
    if (m[1] !== undefined) {
      const rest = after.slice(0, LIST_END.exec(after)?.index ?? after.length);
      raw.push(...(rest.match(SIDED_END) ?? []));
    }
    const inUse = !isArr && !isDep && (m[0].includes('IN USE') || IN_USE.test(after));
    for (const item of raw) {
      const end = runwayEnd(item);
      if (!end) continue;
      if (isArr || (inUse && only !== 'departure')) arrivals.push(end);
      if (isDep || (inUse && only !== 'arrival')) departures.push(end);
      if (!isArr && !isDep && !inUse) unstated.push(end);
    }
  }

  // Runways named with no use: the station's use when it has one and the text
  // did not state it, both uses when the text states none at all.
  if (only === 'arrival' && arrivals.length === 0) arrivals.push(...unstated);
  else if (only === 'departure' && departures.length === 0) departures.push(...unstated);
  else if (only === null && arrivals.length === 0 && departures.length === 0) {
    arrivals.push(...unstated);
    departures.push(...unstated);
  }
  const unique = (ends: string[]) => [...new Set(ends)];
  return {
    arrivals: unique(arrivals),
    departures: unique(departures),
    all: unique([...arrivals, ...departures]),
  };
}

/** Runways named in the broadcast: "RWY 25L", "RUNWAY 07", "RY 18". */
export function atisRunways(lines: string[]): string[] {
  return atisRunwayUse(lines).all;
}

// IVAO's generated ATIS has one fixed part, "ARR RWY 26L 27R DEP RWY 26R 27L TL FL070",
// followed by the controller's free remarks.
const IVAO_RUNWAYS = /\bARR RWY\b(.*?)\bDEP RWY\b(.*?)(?=\bTL\b|\bTA\b|\bRMK\b|\bCONFIRM\b|$)/;

/**
 * The runways off IVAO's fixed part, so a remark ("YOU CAN VACATE VIA RUNWAY
 * 24") is not read as a runway in use. Null when the broadcast has no such part.
 */
export function ivaoRunwayUse(lines: string[]): AtisRunwayUse | null {
  const m = IVAO_RUNWAYS.exec(broadcastLines(lines).join(' ').toUpperCase());
  if (!m) return null;
  const ends = (part: string | undefined) => [
    ...new Set((part?.match(/\b\d{1,2}[LRC]?\b/g) ?? []).flatMap((raw) => runwayEnd(raw) ?? [])),
  ];
  const arrivals = ends(m[1]);
  const departures = ends(m[2]);
  if (arrivals.length === 0 && departures.length === 0) return null;
  return { arrivals, departures, all: [...new Set([...arrivals, ...departures])] };
}

/** An ATIS station as the airport's staffing carries it. */
interface AtisStation {
  network?: 'vatsim' | 'ivao';
  callsign: string;
  atis: { code: string | null; lines: string[] } | null;
}

/** The runways in use at an airport and the ATIS letter behind each use. */
export interface AirportRunwayUse extends AtisRunwayUse {
  arrivalLetter: string | null;
  departureLetter: string | null;
  /** Landing and takeoff use different runways, so the panel names them apart. */
  split: boolean;
}

/** KDFW_A_ATIS is the arrival broadcast, KDFW_D_ATIS the departure one. */
export function stationUse(callsign: string): RunwayUse | null {
  if (/_A_ATIS$/i.test(callsign)) return 'arrival';
  if (/_D_ATIS$/i.test(callsign)) return 'departure';
  return null;
}

/**
 * Every broadcast at the airport read together; null when none names a runway.
 * `isRunway` keeps only the ends the airport has, so "DEPARTURES IN PROG RWYS
 * 24 AND 25" at KLAX (the two complexes) does not pass for runways.
 */
export function airportRunwayUse(
  stations: AtisStation[],
  isRunway: (end: string) => boolean = () => true
): AirportRunwayUse | null {
  const arrivals = new Set<string>();
  const departures = new Set<string>();
  const all = new Set<string>();
  let arrivalLetter: string | null = null;
  let departureLetter: string | null = null;
  for (const station of stations) {
    if (!station.atis) continue;
    const only = stationUse(station.callsign);
    const read =
      (station.network === 'ivao' ? ivaoRunwayUse(station.atis.lines) : null) ??
      atisRunwayUse(station.atis.lines, only);
    const use = {
      arrivals: read.arrivals.filter(isRunway),
      departures: read.departures.filter(isRunway),
    };
    for (const end of use.arrivals) arrivals.add(end);
    for (const end of use.departures) departures.add(end);
    for (const end of [...use.arrivals, ...use.departures]) all.add(end);
    if (only !== 'departure' && use.arrivals.length > 0) arrivalLetter ??= station.atis.code;
    if (only !== 'arrival' && use.departures.length > 0) departureLetter ??= station.atis.code;
  }
  if (all.size === 0) return null;
  const split =
    arrivals.size > 0 &&
    departures.size > 0 &&
    (arrivals.size !== departures.size || [...arrivals].some((end) => !departures.has(end)));
  return {
    arrivals: [...arrivals],
    departures: [...departures],
    all: [...all],
    arrivalLetter,
    departureLetter,
    split,
  };
}
