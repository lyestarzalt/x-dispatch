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

  // Group lines by procedure
  const procedureGroups: Map<string, { type: ProcedureType; lines: string[] }> = new Map();

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

    // Create procedure key: type-name-runway-transition
    const routeType = data[1]?.trim() || '';
    const name = data[2]?.trim() || '';
    const runway = data[3]?.trim() || '';

    // Route types: 1=runway transition, 2=common route, 5=enroute transition, 6=runway transition
    const transition = routeType === '6' || routeType === '5' ? runway : null;
    const actualRunway = routeType === '1' || routeType === '2' ? runway : null;

    const key = `${procType}-${name}-${actualRunway || 'ALL'}-${transition || ''}`;

    if (!procedureGroups.has(key)) {
      procedureGroups.set(key, { type: procType, lines: [] });
    }
    procedureGroups.get(key)!.lines.push(line);
  }

  // Process each procedure group
  for (const [key, group] of procedureGroups) {
    const parts = key.split('-');
    const procType = parts[0] as ProcedureType;
    const name = parts[1];
    const runway = parts[2] === 'ALL' ? null : parts[2];
    const transition = parts[3] || null;

    const waypoints: ProcedureWaypoint[] = [];

    for (const line of group.lines) {
      const parsed = parseCIFPLine(line);
      if (!parsed) continue;

      const wp = parseWaypoint(parsed.data);
      if (wp) {
        waypoints.push(wp);
      }
    }

    if (waypoints.length === 0) continue;

    const procedure: Procedure = {
      type: procType,
      name,
      runway,
      transition,
      waypoints,
    };

    switch (procType) {
      case 'SID':
        procedures.sids.push(procedure);
        break;
      case 'STAR':
        procedures.stars.push(procedure);
        break;
      case 'APPROACH':
        procedures.approaches.push(procedure);
        break;
    }
  }

  return procedures;
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
