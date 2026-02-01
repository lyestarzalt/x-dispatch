export interface ProcedureWaypoint {
  fixId: string;
  fixRegion: string;
  fixType: string; // E = Enroute waypoint, V = VOR, N = NDB, A = Airport
  pathTerminator: string; // IF, TF, CF, DF, VA, VM, etc.
  course: number | null;
  distance: number | null;
  altitude: {
    descriptor: string; // +, -, @, B (at or above, at or below, at, between)
    altitude1: number | null;
    altitude2: number | null;
  } | null;
  speed: number | null;
  turnDirection: 'L' | 'R' | null;
}

export interface Procedure {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  runway: string | null; // null for "ALL" runways
  transition: string | null;
  waypoints: ProcedureWaypoint[];
}

export interface AirportProcedures {
  icao: string;
  sids: Procedure[];
  stars: Procedure[];
  approaches: Procedure[];
}

// Path terminator types
const PATH_TERMINATORS: Record<string, string> = {
  IF: 'Initial Fix',
  TF: 'Track to Fix',
  CF: 'Course to Fix',
  DF: 'Direct to Fix',
  FA: 'Fix to Altitude',
  FC: 'Track from Fix to DME',
  FD: 'Track from Fix to DME Distance',
  FM: 'From Fix to Manual',
  CA: 'Course to Altitude',
  CD: 'Course to DME',
  CI: 'Course to Intercept',
  CR: 'Course to Radial',
  RF: 'Constant Radius Arc',
  AF: 'Arc to Fix',
  VA: 'Heading to Altitude',
  VD: 'Heading to DME',
  VI: 'Heading to Intercept',
  VM: 'Heading to Manual',
  VR: 'Heading to Radial',
  PI: 'Procedure Turn',
  HA: 'Racetrack to Altitude',
  HF: 'Racetrack to Fix',
  HM: 'Racetrack to Manual',
};

/**
 * Parse a CIFP line
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
 * Parse altitude from CIFP format
 * Examples: "+02500", "-05000", "@10000", "B0500018000"
 */
function parseAltitude(
  altStr: string
): { descriptor: string; altitude1: number | null; altitude2: number | null } | null {
  if (!altStr || altStr.trim() === '') return null;

  const str = altStr.trim();
  if (str.length === 0) return null;

  const descriptor = str[0];
  const rest = str.substring(1);

  if (descriptor === 'B' && rest.length >= 10) {
    // Between altitudes
    return {
      descriptor: 'B',
      altitude1: parseInt(rest.substring(0, 5), 10) || null,
      altitude2: parseInt(rest.substring(5, 10), 10) || null,
    };
  }

  const alt = parseInt(rest, 10);
  if (isNaN(alt)) return null;

  return {
    descriptor: ['+', '-', '@'].includes(descriptor) ? descriptor : '@',
    altitude1: alt,
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
  const fixType = data[6]?.trim() || '';
  const pathTerminator = data[11]?.trim() || '';

  // Parse course from field 18 (if present)
  const courseStr = data[18]?.trim() || '';
  const course = courseStr ? parseFloat(courseStr) / 10 : null;

  // Parse distance from field 19 (if present)
  const distStr = data[19]?.trim() || '';
  const distance = distStr ? parseFloat(distStr) / 10 : null;

  // Parse altitude - descriptor at index 22, altitude at index 23
  const altDescriptor = data[22]?.trim() || '';
  const alt1Str = data[23]?.trim() || '';
  let altitude: ProcedureWaypoint['altitude'] = null;
  if (alt1Str) {
    const alt1 = parseInt(alt1Str, 10);
    if (!isNaN(alt1)) {
      altitude = {
        descriptor: ['+', '-', '@', 'B'].includes(altDescriptor) ? altDescriptor : '@',
        altitude1: alt1,
        altitude2: null,
      };
    }
  }

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
    turnDirection: null,
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
  const procedureGroups: Map<string, { type: 'SID' | 'STAR' | 'APPROACH'; lines: string[] }> =
    new Map();

  for (const line of lines) {
    if (!line.trim()) continue;

    const parsed = parseCIFPLine(line);
    if (!parsed) continue;

    const { type, data } = parsed;

    // Determine procedure type
    let procType: 'SID' | 'STAR' | 'APPROACH' | null = null;
    if (type === 'SID') procType = 'SID';
    else if (type === 'STAR') procType = 'STAR';
    else if (type === 'APPCH' || type === 'FINAL' || type.startsWith('RWY')) procType = 'APPROACH';

    if (!procType) continue;

    // Create procedure key: type-name-runway-transition
    const routeType = data[1]?.trim() || '';
    const name = data[2]?.trim() || '';
    const runway = data[3]?.trim() || '';

    // Route types: 1=runway transition, 4=common route, 5=enroute transition, 6=runway transition
    const transition = routeType === '6' || routeType === '5' ? runway : null;
    const actualRunway = routeType === '1' || routeType === '4' ? runway : null;

    const key = `${procType}-${name}-${actualRunway || 'ALL'}-${transition || ''}`;

    if (!procedureGroups.has(key)) {
      procedureGroups.set(key, { type: procType, lines: [] });
    }
    procedureGroups.get(key)!.lines.push(line);
  }

  // Process each procedure group
  for (const [key, group] of procedureGroups) {
    const parts = key.split('-');
    const procType = parts[0] as 'SID' | 'STAR' | 'APPROACH';
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

export function getUniqueProcedureNames(procedures: Procedure[]): string[] {
  const names = new Set<string>();
  for (const proc of procedures) {
    names.add(proc.name);
  }
  return Array.from(names).sort();
}

export function getProcedureRunways(procedures: Procedure[], name: string): string[] {
  const runways = new Set<string>();
  for (const proc of procedures) {
    if (proc.name === name && proc.runway) {
      runways.add(proc.runway);
    }
  }
  return Array.from(runways).sort();
}

export function getProcedureTransitions(procedures: Procedure[], name: string): string[] {
  const transitions = new Set<string>();
  for (const proc of procedures) {
    if (proc.name === name && proc.transition) {
      transitions.add(proc.transition);
    }
  }
  return Array.from(transitions).sort();
}
