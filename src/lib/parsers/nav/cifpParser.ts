/**
 * CIFP Parser
 * Parses X-Plane CIFP/{ICAO}.dat files for SID, STAR, and Approach procedures
 */
import type {
  AirportProcedures,
  AltitudeConstraint,
  AltitudeDescriptor,
  FixTypeCode,
  PathTerminator,
  Procedure,
  ProcedureType,
  ProcedureWaypoint,
  SpeedDescriptor,
  TurnDirection,
} from '@/types/navigation';

// Re-export types for backward compatibility
export type {
  AirportProcedures,
  AltitudeConstraint,
  AltitudeDescriptor,
  FixTypeCode,
  PathTerminator,
  Procedure,
  ProcedureType,
  ProcedureWaypoint,
  SpeedDescriptor,
  TurnDirection,
} from '@/types/navigation';

// Valid values for type checking
const VALID_FIX_TYPES: FixTypeCode[] = ['A', 'C', 'D', 'E', 'N', 'P', 'V'];
const VALID_PATH_TERMINATORS: PathTerminator[] = [
  'IF',
  'TF',
  'CF',
  'DF',
  'FA',
  'FC',
  'FD',
  'FM',
  'CA',
  'CD',
  'CI',
  'CR',
  'RF',
  'AF',
  'VA',
  'VD',
  'VI',
  'VM',
  'VR',
  'PI',
  'HA',
  'HF',
  'HM',
];
const VALID_ALTITUDE_DESCRIPTORS: AltitudeDescriptor[] = ['+', '-', '@', 'B'];
const VALID_TURN_DIRECTIONS: TurnDirection[] = ['L', 'R'];
const VALID_SPEED_DESCRIPTORS: SpeedDescriptor[] = ['+', '-'];

/**
 * Parse a CIFP line into type and data fields
 * Format: TYPE:SEQ,ROUTE_TYPE,NAME,RUNWAY,FIX,FIX_REGION,FIX_TYPE,DESC_CODE,...
 */
function parseCIFPLine(line: string): { type: string; data: string[] } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const type = line.substring(0, colonIdx).trim();
  const rest = line.substring(colonIdx + 1);

  // Deliberately not trimmed per-field: DESC_CODE's character position matters (see
  // `hasMapFlag`), and every other field already trims itself at its own use site.
  const data = rest.split(',');

  return { type, data };
}

/**
 * The Missed Approach Point flag: DESC_CODE (field 8, untrimmed) has 'M' as its 3rd character.
 * Matches atools' own check (`waypointDescr.at(2) == 'M'`, procedurewriter.cpp) exactly - trimming
 * the field first would lose the character's position.
 */
function hasMapFlag(descCode: string | undefined): boolean {
  return (descCode ?? '').charAt(2) === 'M';
}

/**
 * Parse fix type from CIFP field
 */
function parseFixType(value: string): FixTypeCode {
  const trimmed = value.trim().charAt(0).toUpperCase();
  return VALID_FIX_TYPES.includes(trimmed as FixTypeCode) ? (trimmed as FixTypeCode) : 'E';
}

/**
 * Parse path terminator from CIFP field
 */
const FIXLESS_TERMINATORS = new Set<PathTerminator>([
  'CA',
  'CD',
  'CI',
  'CR',
  'VA',
  'VD',
  'VI',
  'VM',
  'VR',
]);

const SINGLE_RUNWAY_RE = /^RW\d{2}[LCRB]?$/;

/**
 * Runway named by a common-route line, kept only while every such line agrees.
 * "ALL", blanks and disagreements leave the procedure open to any runway.
 */
function mergeCommonRunway(current: string | null | undefined, field: string): string | null {
  const runway = SINGLE_RUNWAY_RE.test(field) ? field : null;
  if (current === undefined) return runway;
  return current === runway ? current : null;
}

function parsePathTerminator(value: string): PathTerminator {
  const trimmed = value.trim().toUpperCase();
  return VALID_PATH_TERMINATORS.includes(trimmed as PathTerminator)
    ? (trimmed as PathTerminator)
    : 'TF';
}

/**
 * Parse altitude descriptor
 */
function parseAltitudeDescriptor(value: string): AltitudeDescriptor {
  const trimmed = value.trim();
  return VALID_ALTITUDE_DESCRIPTORS.includes(trimmed as AltitudeDescriptor)
    ? (trimmed as AltitudeDescriptor)
    : '@';
}

/**
 * Parse turn direction
 */
function parseTurnDirection(value: string): TurnDirection | null {
  const trimmed = value.trim().toUpperCase();
  return VALID_TURN_DIRECTIONS.includes(trimmed as TurnDirection)
    ? (trimmed as TurnDirection)
    : null;
}

/**
 * Parse speed descriptor (blank means "at", not encoded as its own value)
 */
function parseSpeedDescriptor(value: string): SpeedDescriptor | null {
  const trimmed = value.trim();
  return VALID_SPEED_DESCRIPTORS.includes(trimmed as SpeedDescriptor)
    ? (trimmed as SpeedDescriptor)
    : null;
}

/** A feet value, or an explicit flight level ("FL060") converted to feet. */
function parseFeetField(raw: string): number | null {
  const isFlightLevel = raw.startsWith('FL');
  const value = parseInt(isFlightLevel ? raw.slice(2) : raw, 10);
  if (isNaN(value)) return null;
  return isFlightLevel ? value * 100 : value;
}

/**
 * Parse altitude constraint from CIFP fields
 */
function parseAltitude(
  descriptor: string,
  alt1Str: string,
  alt2Str: string
): AltitudeConstraint | null {
  const raw = alt1Str.trim();
  if (!raw) return null;

  const isFlightLevel = raw.startsWith('FL');
  const value = parseFeetField(raw);
  if (value === null) return null;

  const raw2 = alt2Str.trim();

  return {
    descriptor: parseAltitudeDescriptor(descriptor),
    altitude1: value,
    altitude2: raw2 ? parseFeetField(raw2) : null,
    isFlightLevel,
  };
}

/**
 * ARINC 424 RNP field: two mantissa digits plus a power-of-ten exponent digit. "990" is 99.0 NM
 * (exponent 0); "013" is 0.001 NM (01 x 10^-3).
 */
function parseRnp(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const exponent = raw.charAt(2);
  if (!exponent || exponent === '0') return parseFloat(raw) / 10;
  return parseFloat(raw.slice(0, 2)) * Math.pow(10, -Number(exponent));
}

/**
 * Parse a procedure waypoint from CIFP data array
 */
function parseWaypoint(data: string[]): ProcedureWaypoint | null {
  // Minimal required fields: sequence, route_type, name, runway, fix
  if (data.length < 11) return null;

  const fixId = data[4]?.trim() || '';
  const pathTerminator = parsePathTerminator(data[11] || '');
  // Course and heading legs (climb to an altitude, fly to a DME distance, intercept) carry
  // no fix. They are kept, unresolved, so the initial climb can be drawn to length.
  if (!fixId && !FIXLESS_TERMINATORS.has(pathTerminator)) return null;

  const fixRegion = data[5]?.trim() || '';
  const fixType = parseFixType(data[6] || '');

  // Parse turn direction from field 9
  const turnDirection = parseTurnDirection(data[9] || '');
  const rnp = parseRnp(data[10] || '');

  // Recommended navaid for the leg (AF arc station, CF/CI/CR/PI reference) - fields 13/14.
  const recNavaid = data[13]?.trim() || null;
  const recNavaidRegion = data[14]?.trim() || null;

  // Arc radius (RF legs only) - field 17.
  const arcRadiusStr = data[17]?.trim() || '';
  const arcRadius = arcRadiusStr ? parseFloat(arcRadiusStr) / 100 : null;

  // Theta/rho from the recommended navaid - fields 18/19. For AF legs rho *is* the arc radius.
  const thetaStr = data[18]?.trim() || '';
  const theta = thetaStr ? parseFloat(thetaStr) / 10 : null;
  const rhoStr = data[19]?.trim() || '';
  const rho = rhoStr ? parseFloat(rhoStr) / 10 : null;

  // The leg's own magnetic course - field 20.
  const courseStr = data[20]?.trim() || '';
  const course = courseStr ? parseFloat(courseStr) / 10 : null;

  // Field 21 is dual-purpose (ARINC 424 RTE_DIST_HOLD_DIST_TIME): a "T"-prefixed value is
  // hold/route time in minutes/10, otherwise it's route distance in NM/10.
  const distTimeStr = data[21]?.trim() || '';
  let distance: number | null = null;
  let holdTimeMin: number | null = null;
  if (distTimeStr.toUpperCase().startsWith('T')) {
    const minutes = parseFloat(distTimeStr.slice(1));
    holdTimeMin = isNaN(minutes) ? null : minutes / 10;
  } else if (distTimeStr) {
    const nm = parseFloat(distTimeStr);
    distance = isNaN(nm) ? null : nm / 10;
  }

  // Altitude - descriptor at 22, primary altitude at 23, secondary (for "B" between) at 24.
  const altDescriptor = data[22]?.trim() || '';
  const alt1Str = data[23]?.trim() || '';
  const alt2Str = data[24]?.trim() || '';
  const altitude = parseAltitude(altDescriptor, alt1Str, alt2Str);

  // Speed descriptor at 26, the actual speed constraint at 27 (field 25 is TRANS_ALT, unrelated).
  const speedDescriptor = parseSpeedDescriptor(data[26] || '');
  const speedStr = data[27]?.trim() || '';
  const speed = speedStr ? parseInt(speedStr, 10) : null;

  // Vertical path angle (tenths of a degree, negative = descent) - field 28.
  const verticalAngleStr = data[28]?.trim() || '';
  const verticalAngle = verticalAngleStr ? parseFloat(verticalAngleStr) / 100 : null;

  // Fields 30/31 double as an arc/hold center fix (RF legs) and an unrelated TAA reference point
  // on every other leg type - only trust them as a center for RF, matching atools' own
  // `pathTerm == 'RF'` gate in procedurewriter.cpp.
  const centerFix = pathTerminator === 'RF' ? data[30]?.trim() || null : null;
  const centerFixRegion = pathTerminator === 'RF' ? data[31]?.trim() || null : null;

  return {
    fixId,
    fixRegion,
    fixType,
    pathTerminator,
    course,
    distance,
    altitude,
    speed,
    speedDescriptor,
    turnDirection,
    recNavaid,
    recNavaidRegion,
    theta,
    rho,
    arcRadius,
    centerFix,
    centerFixRegion,
    verticalAngle,
    rnp,
    holdTimeMin,
    // Set by parseWaypointsFromLines, which knows the leg's sequence relative to the MAP.
    isMissedApproach: false,
  };
}

interface ProcedureComponents {
  enrouteTransitions: Map<string, string[]>; // Entry/exit point name -> lines
  commonRoute: string[]; // Shared segment
  /** Runway the common route is published for, when it names exactly one; undefined until seen. */
  commonRunway?: string | null;
  runwayTransitions: Map<string, string[]>; // Runway name -> lines
}

type Segment = 'runway' | 'common' | 'enroute';

/** ARINC 424 5.7 route types: conventional 1-3, RNAV 4-6, FMS F/M/S, vector T/V, engine-out 0. */
const SID_SEGMENTS: Record<string, Segment | undefined> = {
  '0': 'common',
  '1': 'runway',
  '2': 'common',
  '3': 'enroute',
  '4': 'runway',
  '5': 'common',
  '6': 'enroute',
  F: 'runway',
  M: 'common',
  S: 'enroute',
  T: 'runway',
  V: 'enroute',
};

/** STAR order is reversed: 1/4/7/F enroute, 2/5/8/M common, 3/6/9/S runway. */
const STAR_SEGMENTS: Record<string, Segment | undefined> = {
  '1': 'enroute',
  '2': 'common',
  '3': 'runway',
  '4': 'enroute',
  '5': 'common',
  '6': 'runway',
  '7': 'enroute',
  '8': 'common',
  '9': 'runway',
  F: 'enroute',
  M: 'common',
  S: 'runway',
};

function addComponentLine(
  comp: ProcedureComponents,
  segment: Segment | undefined,
  field: string,
  line: string
): void {
  // The transition field is a runway or a fix name; blank or "ALL" means the leg is shared.
  const shared = !field || field === 'ALL';
  if (segment === 'runway' && !shared) {
    if (!comp.runwayTransitions.has(field)) comp.runwayTransitions.set(field, []);
    comp.runwayTransitions.get(field)!.push(line);
  } else if (segment === 'enroute' && !shared) {
    if (!comp.enrouteTransitions.has(field)) comp.enrouteTransitions.set(field, []);
    comp.enrouteTransitions.get(field)!.push(line);
  } else {
    comp.commonRoute.push(line);
    comp.commonRunway = mergeCommonRunway(comp.commonRunway, field);
  }
}

/**
 * Parse CIFP file content for an airport
 */
export function parseCIFP(content: string, icao: string): AirportProcedures {
  const lines = content.split('\n');
  const procedures: AirportProcedures = {
    icao,
    sids: [],
    stars: [],
    approaches: [],
  };

  // Separate storage for approach components
  const approachComponents: Map<
    string,
    { transitions: Map<string, string[]>; finalApproach: string[] }
  > = new Map();

  // Separate storage for SID/STAR components
  const sidComponents: Map<string, ProcedureComponents> = new Map();
  const starComponents: Map<string, ProcedureComponents> = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;

    const parsed = parseCIFPLine(line);
    if (!parsed) continue;

    const { type, data } = parsed;

    // Determine procedure type
    let procType: ProcedureType | null = null;
    if (type === 'SID') procType = 'SID';
    else if (type === 'STAR') procType = 'STAR';
    else if (type === 'APPCH' || type === 'FINAL' || type.startsWith('RWY')) procType = 'APPROACH';

    if (!procType) continue;

    const routeType = data[1]?.trim() || '';
    const name = data[2]?.trim() || '';
    const runway = data[3]?.trim() || '';

    // Handle approaches separately
    if (procType === 'APPROACH') {
      if (!approachComponents.has(name)) {
        approachComponents.set(name, { transitions: new Map(), finalApproach: [] });
      }
      const component = approachComponents.get(name)!;

      if (routeType === 'A') {
        const transitionName = runway;
        if (!component.transitions.has(transitionName)) {
          component.transitions.set(transitionName, []);
        }
        component.transitions.get(transitionName)!.push(line);
      } else {
        component.finalApproach.push(line);
      }
      continue;
    }

    // Handle STARs with component-based approach
    if (procType === 'STAR') {
      if (!starComponents.has(name)) {
        starComponents.set(name, {
          enrouteTransitions: new Map(),
          commonRoute: [],
          commonRunway: undefined,
          runwayTransitions: new Map(),
        });
      }
      addComponentLine(starComponents.get(name)!, STAR_SEGMENTS[routeType], runway, line);
      continue;
    }

    // Handle SIDs with component-based approach
    if (procType === 'SID') {
      if (!sidComponents.has(name)) {
        sidComponents.set(name, {
          enrouteTransitions: new Map(),
          commonRoute: [],
          commonRunway: undefined,
          runwayTransitions: new Map(),
        });
      }
      addComponentLine(sidComponents.get(name)!, SID_SEGMENTS[routeType], runway, line);
      continue;
    }
  }

  for (const [name, comp] of starComponents) {
    procedures.stars.push(...assembleProcedures('STAR', name, comp));
  }
  for (const [name, comp] of sidComponents) {
    procedures.sids.push(...assembleProcedures('SID', name, comp));
  }

  // Process approaches - combine transitions with final approach
  for (const [name, component] of approachComponents) {
    const finalWaypoints = parseWaypointsFromLines(component.finalApproach);

    if (component.transitions.size === 0) {
      if (finalWaypoints.length > 0) {
        procedures.approaches.push({
          type: 'APPROACH',
          name,
          runway: null,
          transition: null,
          waypoints: finalWaypoints,
        });
      }
    } else {
      for (const [transitionName, transitionLines] of component.transitions) {
        const transitionWaypoints = parseWaypointsFromLines(transitionLines);
        const combined = combineWaypoints(transitionWaypoints, finalWaypoints);
        if (combined.length > 0) {
          procedures.approaches.push({
            type: 'APPROACH',
            name,
            runway: null,
            transition: transitionName,
            waypoints: combined,
          });
        }
      }
    }
  }

  return procedures;
}

/**
 * One procedure per runway and enroute transition pairing. A SID runs runway leg, common route,
 * then transition; a STAR runs the other way round. A procedure with no transitions of a kind
 * yields a single variant, whose runway comes from the common route when it names one.
 */
function assembleProcedures(
  type: 'SID' | 'STAR',
  name: string,
  comp: ProcedureComponents
): Procedure[] {
  const common = parseWaypointsFromLines(comp.commonRoute);
  const none: [string | null, string[]][] = [[null, []]];
  const runways = comp.runwayTransitions.size ? [...comp.runwayTransitions] : none;
  const transitions = comp.enrouteTransitions.size ? [...comp.enrouteTransitions] : none;
  const out: Procedure[] = [];
  for (const [rwy, rwyLines] of runways) {
    const rwyWaypoints = parseWaypointsFromLines(rwyLines);
    const runway = (rwy ?? comp.commonRunway ?? null)?.replace(/^RW/, '') ?? null;
    for (const [transition, transLines] of transitions) {
      const transWaypoints = parseWaypointsFromLines(transLines);
      const waypoints =
        type === 'SID'
          ? combineWaypoints(combineWaypoints(rwyWaypoints, common), transWaypoints)
          : combineWaypoints(combineWaypoints(transWaypoints, common), rwyWaypoints);
      if (waypoints.length > 0) out.push({ type, name, runway, transition, waypoints });
    }
  }
  return out;
}

/**
 * Combine two waypoint arrays, removing duplicate at junction
 */
function combineWaypoints(
  first: ProcedureWaypoint[],
  second: ProcedureWaypoint[]
): ProcedureWaypoint[] {
  if (first.length === 0) return [...second];
  if (second.length === 0) return [...first];

  const lastFirst = first[first.length - 1]?.fixId;
  const firstSecond = second[0]?.fixId;

  if (lastFirst === firstSecond) {
    return [...first, ...second.slice(1)];
  }
  return [...first, ...second];
}

/**
 * Parse waypoints from CIFP lines, sorted by sequence number
 */
function parseWaypointsFromLines(lines: string[]): ProcedureWaypoint[] {
  const waypointsWithSeq: Array<{ seq: number; wp: ProcedureWaypoint; mapFlag: boolean }> = [];

  for (const line of lines) {
    const parsed = parseCIFPLine(line);
    if (!parsed) continue;

    const seqStr = parsed.data[0]?.trim() || '0';
    const seq = parseInt(seqStr, 10) || 0;

    const wp = parseWaypoint(parsed.data);
    if (wp) {
      waypointsWithSeq.push({ seq, wp, mapFlag: hasMapFlag(parsed.data[8]) });
    }
  }

  waypointsWithSeq.sort((a, b) => a.seq - b.seq);

  // The Missed Approach Point flag, once seen, applies to every later leg in this line group.
  let missed = false;
  for (const item of waypointsWithSeq) {
    if (item.mapFlag) missed = true;
    item.wp.isMissedApproach = missed;
  }

  return waypointsWithSeq.map((item) => item.wp);
}

/**
 * Get unique procedure names from a list of procedures
 */
export function getUniqueProcedureNames(procedures: Procedure[]): string[] {
  const names = new Set<string>();
  for (const proc of procedures) {
    names.add(proc.name);
  }
  return Array.from(names).sort();
}

/**
 * Get runways for a specific procedure name
 */
export function getProcedureRunways(procedures: Procedure[], name: string): string[] {
  const runways = new Set<string>();
  for (const proc of procedures) {
    if (proc.name === name && proc.runway) {
      runways.add(proc.runway);
    }
  }
  return Array.from(runways).sort();
}

/**
 * Get transitions for a specific procedure name
 */
export function getProcedureTransitions(procedures: Procedure[], name: string): string[] {
  const transitions = new Set<string>();
  for (const proc of procedures) {
    if (proc.name === name && proc.transition) {
      transitions.add(proc.transition);
    }
  }
  return Array.from(transitions).sort();
}
