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

/**
 * Parse a CIFP line into type and data fields
 * Format: TYPE:SEQ,ROUTE_TYPE,NAME,RUNWAY,FIX,FIX_REGION,FIX_TYPE,DESC_CODE,...
 */
function parseCIFPLine(line: string): { type: string; data: string[] } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const type = line.substring(0, colonIdx).trim();
  const rest = line.substring(colonIdx + 1);

  // Split by comma, handling potential whitespace
  const data = rest.split(',').map((s) => s.trim());

  return { type, data };
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
 * Parse altitude constraint from CIFP fields
 */
function parseAltitude(descriptor: string, alt1Str: string): AltitudeConstraint | null {
  if (!alt1Str || alt1Str.trim() === '') return null;

  const alt1 = parseInt(alt1Str, 10);
  if (isNaN(alt1)) return null;

  return {
    descriptor: parseAltitudeDescriptor(descriptor),
    altitude1: alt1,
    altitude2: null,
  };
}

/**
 * Parse a procedure waypoint from CIFP data array
 */
function parseWaypoint(data: string[]): ProcedureWaypoint | null {
  // Minimal required fields: sequence, route_type, name, runway, fix
  if (data.length < 11) return null;

  const fixId = data[4]?.trim() || '';
  if (!fixId) return null; // Skip lines without a fix

  const fixRegion = data[5]?.trim() || '';
  const fixType = parseFixType(data[6] || '');
  const pathTerminator = parsePathTerminator(data[11] || '');

  // Parse turn direction from field 9
  const turnDirection = parseTurnDirection(data[9] || '');

  // Parse course from field 18 (if present)
  const courseStr = data[18]?.trim() || '';
  const course = courseStr ? parseFloat(courseStr) / 10 : null;

  // Parse distance from field 19 (if present)
  const distStr = data[19]?.trim() || '';
  const distance = distStr ? parseFloat(distStr) / 10 : null;

  // Parse altitude - descriptor at index 22, altitude at index 23
  const altDescriptor = data[22]?.trim() || '';
  const alt1Str = data[23]?.trim() || '';
  const altitude = parseAltitude(altDescriptor, alt1Str);

  // Parse speed from field 25 (if present)
  const speedStr = data[25]?.trim() || '';
  const speed = speedStr ? parseInt(speedStr, 10) : null;

  return {
    fixId,
    fixRegion,
    fixType,
    pathTerminator,
    course,
    distance,
    altitude,
    speed,
    turnDirection,
  };
}

/**
 * Component storage for SID/STAR procedures
 * STARs: enroute transitions (type 4) + common (type 5/2) + runway transitions (type 6/1)
 * SIDs: runway transitions (type 1/2) + common (type 3) + enroute transitions (type 4/5/6)
 */
interface ProcedureComponents {
  enrouteTransitions: Map<string, string[]>; // Entry/exit point name -> lines
  commonRoute: string[]; // Shared segment
  runwayTransitions: Map<string, string[]>; // Runway name -> lines
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
          runwayTransitions: new Map(),
        });
      }
      const comp = starComponents.get(name)!;

      // STAR route types:
      // 1 = Runway transition (specific runway)
      // 2 = Common route (runway = "ALL" or specific)
      // 4 = Enroute transition (runway field = transition name like INYOE)
      // 5 = Common route (runway field empty or runway-specific)
      // 6 = Runway transition (runway field = RW28B etc)
      if (routeType === '4') {
        // Enroute transition - runway field is transition name
        if (!comp.enrouteTransitions.has(runway)) {
          comp.enrouteTransitions.set(runway, []);
        }
        comp.enrouteTransitions.get(runway)!.push(line);
      } else if (routeType === '6' || (routeType === '1' && runway && runway !== 'ALL')) {
        // Runway transition
        if (!comp.runwayTransitions.has(runway)) {
          comp.runwayTransitions.set(runway, []);
        }
        comp.runwayTransitions.get(runway)!.push(line);
      } else {
        // Common route (type 2, 5, or type 1 with ALL)
        comp.commonRoute.push(line);
      }
      continue;
    }

    // Handle SIDs with component-based approach
    if (procType === 'SID') {
      if (!sidComponents.has(name)) {
        sidComponents.set(name, {
          enrouteTransitions: new Map(),
          commonRoute: [],
          runwayTransitions: new Map(),
        });
      }
      const comp = sidComponents.get(name)!;

      // SID route types:
      // 1 = Runway transition (runway field = RW28L etc)
      // 2 = Common route (runway = "ALL")
      // 3 = Common route
      // 4, 5, 6 = Enroute transition (runway field = transition name)
      if (routeType === '1' && runway && runway !== 'ALL') {
        // Runway transition
        if (!comp.runwayTransitions.has(runway)) {
          comp.runwayTransitions.set(runway, []);
        }
        comp.runwayTransitions.get(runway)!.push(line);
      } else if (routeType === '4' || routeType === '5' || routeType === '6') {
        // Enroute transition - runway field is transition name
        if (runway && runway !== 'ALL') {
          if (!comp.enrouteTransitions.has(runway)) {
            comp.enrouteTransitions.set(runway, []);
          }
          comp.enrouteTransitions.get(runway)!.push(line);
        } else {
          comp.commonRoute.push(line);
        }
      } else {
        // Common route (type 2, 3)
        comp.commonRoute.push(line);
      }
      continue;
    }
  }

  // Process STARs - combine: enroute + common + runway
  for (const [name, comp] of starComponents) {
    const commonWaypoints = parseWaypointsFromLines(comp.commonRoute);

    // If no enroute transitions and no runway transitions, just use common
    if (comp.enrouteTransitions.size === 0 && comp.runwayTransitions.size === 0) {
      if (commonWaypoints.length > 0) {
        procedures.stars.push({
          type: 'STAR',
          name,
          runway: null,
          transition: null,
          waypoints: commonWaypoints,
        });
      }
      continue;
    }

    // If only runway transitions (no enroute), create one per runway
    if (comp.enrouteTransitions.size === 0) {
      for (const [rwy, rwyLines] of comp.runwayTransitions) {
        const rwyWaypoints = parseWaypointsFromLines(rwyLines);
        const combined = combineWaypoints(commonWaypoints, rwyWaypoints);
        if (combined.length > 0) {
          procedures.stars.push({
            type: 'STAR',
            name,
            runway: rwy.replace(/^RW/, ''),
            transition: null,
            waypoints: combined,
          });
        }
      }
      continue;
    }

    // If only enroute transitions (no runway), create one per enroute
    if (comp.runwayTransitions.size === 0) {
      for (const [trans, transLines] of comp.enrouteTransitions) {
        const transWaypoints = parseWaypointsFromLines(transLines);
        const combined = combineWaypoints(transWaypoints, commonWaypoints);
        if (combined.length > 0) {
          procedures.stars.push({
            type: 'STAR',
            name,
            runway: null,
            transition: trans,
            waypoints: combined,
          });
        }
      }
      continue;
    }

    // Both enroute and runway transitions exist
    // Create one procedure per enroute transition (simpler UI)
    // Each includes: enroute + common (runway transitions shown separately)
    for (const [trans, transLines] of comp.enrouteTransitions) {
      const transWaypoints = parseWaypointsFromLines(transLines);
      const combined = combineWaypoints(transWaypoints, commonWaypoints);
      if (combined.length > 0) {
        procedures.stars.push({
          type: 'STAR',
          name,
          runway: null,
          transition: trans,
          waypoints: combined,
        });
      }
    }
  }

  // Process SIDs - combine: runway + common + enroute
  for (const [name, comp] of sidComponents) {
    const commonWaypoints = parseWaypointsFromLines(comp.commonRoute);

    // If no runway transitions and no enroute transitions, just use common
    if (comp.runwayTransitions.size === 0 && comp.enrouteTransitions.size === 0) {
      if (commonWaypoints.length > 0) {
        procedures.sids.push({
          type: 'SID',
          name,
          runway: null,
          transition: null,
          waypoints: commonWaypoints,
        });
      }
      continue;
    }

    // If only runway transitions (no enroute), create one per runway
    if (comp.enrouteTransitions.size === 0) {
      for (const [rwy, rwyLines] of comp.runwayTransitions) {
        const rwyWaypoints = parseWaypointsFromLines(rwyLines);
        const combined = combineWaypoints(rwyWaypoints, commonWaypoints);
        if (combined.length > 0) {
          procedures.sids.push({
            type: 'SID',
            name,
            runway: rwy.replace(/^RW/, ''),
            transition: null,
            waypoints: combined,
          });
        }
      }
      continue;
    }

    // If only enroute transitions (no runway), create one per enroute
    if (comp.runwayTransitions.size === 0) {
      for (const [trans, transLines] of comp.enrouteTransitions) {
        const transWaypoints = parseWaypointsFromLines(transLines);
        const combined = combineWaypoints(commonWaypoints, transWaypoints);
        if (combined.length > 0) {
          procedures.sids.push({
            type: 'SID',
            name,
            runway: null,
            transition: trans,
            waypoints: combined,
          });
        }
      }
      continue;
    }

    // Both runway and enroute transitions exist
    // Create one procedure per runway (simpler UI)
    for (const [rwy, rwyLines] of comp.runwayTransitions) {
      const rwyWaypoints = parseWaypointsFromLines(rwyLines);
      const combined = combineWaypoints(rwyWaypoints, commonWaypoints);
      if (combined.length > 0) {
        procedures.sids.push({
          type: 'SID',
          name,
          runway: rwy.replace(/^RW/, ''),
          transition: null,
          waypoints: combined,
        });
      }
    }
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
  const waypointsWithSeq: Array<{ seq: number; wp: ProcedureWaypoint }> = [];

  for (const line of lines) {
    const parsed = parseCIFPLine(line);
    if (!parsed) continue;

    const seqStr = parsed.data[0]?.trim() || '0';
    const seq = parseInt(seqStr, 10) || 0;

    const wp = parseWaypoint(parsed.data);
    if (wp) {
      waypointsWithSeq.push({ seq, wp });
    }
  }

  waypointsWithSeq.sort((a, b) => a.seq - b.seq);
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
