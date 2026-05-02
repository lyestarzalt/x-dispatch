import { z } from 'zod';
import type {
  Frequency,
  LinearFeature,
  ParsedAirport,
  ParsedPath,
  Pavement,
  RunwayEnd,
  Sign,
  StartupLocation,
  Windsock,
} from '@/types/apt';
import { FrequencyType, RowCode } from '@/types/apt';
import { bearing, coordinate, latitude, longitude, nonNegative, positiveNumber } from '../schemas';
import type { ParseError, ParseResult } from '../types';
import { PathParser } from './pathParser';

/**
 * Safely get a token from the array, returning empty string if not found.
 * Use after verifying array length to satisfy TypeScript strict mode.
 */
function token(tokens: string[], index: number): string {
  return tokens[index] ?? '';
}

const RunwayEndSchema = z.object({
  name: z.string(),
  lat: latitude,
  lon: longitude,
  dthr_length: nonNegative,
  overrun_length: nonNegative,
  marking: z.number(),
  lighting: z.number(),
  tdz_lighting: z.boolean(),
  reil: z.number(),
});
const StartupLocationSchema = z.object({
  lat: latitude,
  lon: longitude,
  heading: bearing,
  location_type: z.string(),
  airplane_types: z.string(),
  name: z.string(),
});

export class AirportParser {
  private lines: string[];
  private errors: ParseError[] = [];
  private skipped = 0;

  constructor(data: string) {
    this.lines = data
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  /**
   * Map an apt.dat frequency row code (legacy 50-56 or modern 1050-1056)
   * to the canonical FrequencyType for the role it represents.
   */
  private getFrequencyType(code: number): FrequencyType {
    switch (code) {
      case RowCode.FREQUENCY_AWOS:
      case RowCode.FREQUENCY_AWOS_833:
        return FrequencyType.AWOS;
      case RowCode.FREQUENCY_CTAF:
      case RowCode.FREQUENCY_CTAF_833:
        return FrequencyType.CTAF;
      case RowCode.FREQUENCY_DELIVERY:
      case RowCode.FREQUENCY_DELIVERY_833:
        return FrequencyType.DELIVERY;
      case RowCode.FREQUENCY_GROUND:
      case RowCode.FREQUENCY_GROUND_833:
        return FrequencyType.GROUND;
      case RowCode.FREQUENCY_TOWER:
      case RowCode.FREQUENCY_TOWER_833:
        return FrequencyType.TOWER;
      case RowCode.FREQUENCY_APPROACH:
      case RowCode.FREQUENCY_APPROACH_833:
        return FrequencyType.APPROACH;
      case RowCode.FREQUENCY_DEPARTURE:
      case RowCode.FREQUENCY_DEPARTURE_833:
        return FrequencyType.DEPARTURE;
      default:
        return FrequencyType.CTAF;
    }
  }

  private validateCoordinate(lat: number, lon: number, context: string, lineNum: number): boolean {
    const result = coordinate.safeParse({ latitude: lat, longitude: lon });
    if (!result.success) {
      this.errors.push({
        line: lineNum,
        path: 'coordinate',
        message: `Invalid coordinate in ${context}`,
      });
      return false;
    }
    return true;
  }

  private parseRunwayEnd(tokens: string[], lineNum: number): RunwayEnd | null {
    if (tokens.length < 9) {
      this.skipped++;
      return null;
    }

    const result = RunwayEndSchema.safeParse({
      name: token(tokens, 0),
      lat: parseFloat(token(tokens, 1)),
      lon: parseFloat(token(tokens, 2)),
      dthr_length: Math.max(0, parseFloat(token(tokens, 3)) || 0),
      overrun_length: Math.max(0, parseFloat(token(tokens, 4)) || 0),
      marking: parseInt(token(tokens, 5)),
      lighting: parseInt(token(tokens, 6)),
      tdz_lighting: Boolean(parseInt(token(tokens, 7))),
      reil: parseInt(token(tokens, 8)),
    });

    if (!result.success) {
      this.skipped++;
      return null;
    }

    return {
      name: result.data.name,
      latitude: result.data.lat,
      longitude: result.data.lon,
      dthr_length: result.data.dthr_length,
      overrun_length: result.data.overrun_length,
      marking: result.data.marking,
      lighting: result.data.lighting,
      tdz_lighting: result.data.tdz_lighting,
      reil: result.data.reil,
    };
  }

  private parseStartupLocation(tokens: string[], lineNum: number): StartupLocation | null {
    if (tokens.length < 6) {
      this.skipped++;
      return null;
    }

    const rawHeading = parseFloat(token(tokens, 3));
    const result = StartupLocationSchema.safeParse({
      lat: parseFloat(token(tokens, 1)),
      lon: parseFloat(token(tokens, 2)),
      heading: Number.isFinite(rawHeading) ? ((rawHeading % 360) + 360) % 360 : 0,
      location_type: token(tokens, 4),
      airplane_types: token(tokens, 5),
      name: tokens.slice(6).join(' '),
    });

    if (!result.success) {
      this.skipped++;
      return null;
    }

    return {
      latitude: result.data.lat,
      longitude: result.data.lon,
      heading: result.data.heading,
      location_type: result.data.location_type,
      airplane_types: result.data.airplane_types,
      name: result.data.name,
    };
  }

  private parseStartupLocationLegacy(tokens: string[], lineNum: number): StartupLocation | null {
    if (tokens.length < 4) {
      this.skipped++;
      return null;
    }

    const rawHeading = parseFloat(token(tokens, 3));
    const result = StartupLocationSchema.safeParse({
      lat: parseFloat(token(tokens, 1)),
      lon: parseFloat(token(tokens, 2)),
      heading: Number.isFinite(rawHeading) ? ((rawHeading % 360) + 360) % 360 : 0,
      location_type: 'misc',
      airplane_types: 'ABCDEF',
      name: tokens.slice(4).join(' ') || 'Startup',
    });

    if (!result.success) {
      this.skipped++;
      return null;
    }

    return {
      latitude: result.data.lat,
      longitude: result.data.lon,
      heading: result.data.heading,
      location_type: result.data.location_type,
      airplane_types: result.data.airplane_types,
      name: result.data.name,
    };
  }

  private parseWindsock(tokens: string[], lineNum: number): Windsock | null {
    if (tokens.length < 4) {
      this.skipped++;
      return null;
    }

    const result = coordinate.safeParse({
      latitude: parseFloat(token(tokens, 1)),
      longitude: parseFloat(token(tokens, 2)),
    });

    if (!result.success) {
      this.skipped++;
      return null;
    }

    return {
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      illuminated: Boolean(parseInt(token(tokens, 3))),
      name: tokens.slice(4).join(' '),
    };
  }

  private parseSign(tokens: string[], lineNum: number): Sign | null {
    if (tokens.length < 7) {
      this.skipped++;
      return null;
    }

    const rawHeading = parseFloat(token(tokens, 3));
    const coordResult = coordinate.safeParse({
      latitude: parseFloat(token(tokens, 1)),
      longitude: parseFloat(token(tokens, 2)),
    });
    const headingResult = bearing.safeParse(rawHeading);

    if (!coordResult.success) {
      this.skipped++;
      return null;
    }

    return {
      latitude: coordResult.data.latitude,
      longitude: coordResult.data.longitude,
      heading: headingResult.success ? headingResult.data : 0,
      size: parseInt(token(tokens, 5)),
      text: token(tokens, 6),
    };
  }

  private parsePavement(tokens: string[], paths: ParsedPath[]): Pavement | null {
    if (tokens.length < 4) return null;
    // First path without isHole is the outer boundary, rest are holes
    const outer = paths.find((p) => !p.isHole);
    const holes = paths.filter((p) => p.isHole);

    return {
      surface_type: parseInt(token(tokens, 1)),
      smoothness: parseFloat(token(tokens, 2)),
      texture_orientation: parseFloat(token(tokens, 3)),
      name: tokens.slice(4).join(' '),
      coordinates: outer?.coordinates || paths[0]?.coordinates || [],
      holes: holes.length > 0 ? holes.map((h) => h.coordinates) : undefined,
    };
  }

  /**
   * Extract edge linear features from pavement paths.
   * Pavements (110) can have line types and light types on their boundary nodes,
   * defining painted edge lines and embedded lights around the pavement.
   */
  private extractPavementEdgeFeatures(name: string, paths: ParsedPath[]): LinearFeature[] {
    // Check if any path has non-zero line or light types
    const hasEdgeMarkings = paths.some((path) =>
      path.lineTypes?.some((lt) => lt.lineType > 0 || lt.lightType > 0)
    );

    if (!hasEdgeMarkings) {
      return [];
    }

    // Reuse parseLinearFeatures logic with a synthetic token array
    return this.parseLinearFeaturesFromPaths(`${name} edge`, paths);
  }

  /**
   * Parse linear feature(s) from path data.
   * Splits into multiple features when line type changes.
   * lineTypes[i] applies to segment from coord[i] to coord[i+1].
   */
  private parseLinearFeatures(tokens: string[], paths: ParsedPath[]): LinearFeature[] {
    const name = tokens.slice(1).join(' ');
    return this.parseLinearFeaturesFromPaths(name, paths);
  }

  /**
   * Core logic for parsing linear features from paths.
   * Used by both standalone linear features (120) and pavement edge markings (110).
   */
  private parseLinearFeaturesFromPaths(name: string, paths: ParsedPath[]): LinearFeature[] {
    const features: LinearFeature[] = [];

    for (const path of paths) {
      const { coordinates, lineTypes } = path;

      if (coordinates.length < 2) {
        continue;
      }

      if (!lineTypes || lineTypes.length !== coordinates.length) {
        continue;
      }

      // Split into segments whenever type changes
      let segStart = 0;
      const firstLineType = lineTypes[0];
      if (!firstLineType) continue;
      let segType = firstLineType.lineType;
      let segLight = firstLineType.lightType;

      for (let i = 1; i < coordinates.length; i++) {
        const lt = lineTypes[i];
        if (!lt) continue;
        const thisType = lt.lineType;
        const thisLight = lt.lightType;

        // Split when type or light changes
        if (thisType !== segType || thisLight !== segLight) {
          // Save current segment (include endpoint coord[i])
          const segCoords = coordinates.slice(segStart, i + 1);
          if (segCoords.length >= 2) {
            features.push({
              name,
              painted_line_type: segType,
              lighting_line_type: segLight,
              coordinates: segCoords,
            });
          }
          // Start new segment from coord[i]
          segStart = i;
          segType = thisType;
          segLight = thisLight;
        }
      }

      // Add final segment
      const segCoords = coordinates.slice(segStart);
      if (segCoords.length >= 2) {
        features.push({
          name,
          painted_line_type: segType,
          lighting_line_type: segLight,
          coordinates: segCoords,
        });
      }
    }

    return features;
  }

  parse(): ParseResult<ParsedAirport> {
    const startTime = Date.now();
    // Per the apt.dat 1200 spec, modern (1050-1056) and legacy (50-56)
    // frequency rows can both be present in a file, but the modern set
    // supersedes — "Ignored if row codes 1050-1056 exist". We collect
    // them into separate buckets and pick the right one after the parse
    // loop finishes.
    const legacyFrequencies: Frequency[] = [];
    const modernFrequencies: Frequency[] = [];
    const airport: ParsedAirport = {
      id: '',
      name: '',
      latitude: 0,
      longitude: 0,
      elevation: 0,
      metadata: {},
      runways: [],
      taxiways: [],
      boundaries: [],
      lines: [],
      startupLocations: [],
      windsocks: [],
      signs: [],
      pavements: [],
      linearFeatures: [],
      frequencies: [],
      helipads: [],
      taxiNetwork: {
        nodes: [],
        edges: [],
        truckEdges: [],
        truckParkings: [],
        truckDestinations: [],
      },
    };

    for (let i = 0; i < this.lines.length; i++) {
      const lineNum = i + 1; // 1-indexed for human readability
      const line = this.lines[i];
      if (!line) continue;
      const tokens = line.split(/\s+/);
      const rawCode = tokens[0];
      if (!rawCode) continue;
      const code = parseInt(rawCode);

      switch (code) {
        case RowCode.AIRPORT_HEADER:
        case RowCode.SEAPLANE_HEADER:
        case RowCode.HELIPORT_HEADER: {
          const elevation = parseFloat(token(tokens, 1));
          airport.elevation = Number.isFinite(elevation) ? elevation : 0;
          airport.id = token(tokens, 4);
          airport.name = tokens.slice(5).join(' ');
          break;
        }

        case RowCode.TOWER_LOCATION: {
          const lat = parseFloat(token(tokens, 1));
          const lon = parseFloat(token(tokens, 2));
          const height = parseFloat(token(tokens, 3));

          if (this.validateCoordinate(lat, lon, 'tower location', lineNum)) {
            airport.towerLocation = {
              latitude: lat,
              longitude: lon,
              height: Number.isFinite(height) ? height : 0,
              name: tokens.slice(4).join(' '),
            };
          }
          break;
        }

        case RowCode.BEACON: {
          const lat = parseFloat(token(tokens, 1));
          const lon = parseFloat(token(tokens, 2));

          if (this.validateCoordinate(lat, lon, 'beacon', lineNum)) {
            airport.beacon = {
              latitude: lat,
              longitude: lon,
              type: parseInt(token(tokens, 3)),
              name: tokens.slice(4).join(' '),
            };
          }
          break;
        }

        case RowCode.HELIPAD: {
          const lat = parseFloat(token(tokens, 2));
          const lon = parseFloat(token(tokens, 3));
          const rawHeading = parseFloat(token(tokens, 4));
          const rawLength = parseFloat(token(tokens, 5));
          const rawWidth = parseFloat(token(tokens, 6));

          const coordResult = coordinate.safeParse({ latitude: lat, longitude: lon });
          if (!coordResult.success) {
            this.skipped++;
            break;
          }

          const normalizedHeading = Number.isFinite(rawHeading)
            ? ((rawHeading % 360) + 360) % 360
            : 0;
          const lengthResult = positiveNumber.safeParse(rawLength);
          const widthResult = positiveNumber.safeParse(rawWidth);

          airport.helipads.push({
            name: token(tokens, 1),
            latitude: lat,
            longitude: lon,
            heading: normalizedHeading,
            length: lengthResult.success ? lengthResult.data : 1,
            width: widthResult.success ? widthResult.data : 1,
            surface_type: parseInt(token(tokens, 7)),
          });
          break;
        }

        case RowCode.FREQUENCY_AWOS:
        case RowCode.FREQUENCY_CTAF:
        case RowCode.FREQUENCY_DELIVERY:
        case RowCode.FREQUENCY_GROUND:
        case RowCode.FREQUENCY_TOWER:
        case RowCode.FREQUENCY_APPROACH:
        case RowCode.FREQUENCY_DEPARTURE: {
          // Legacy 25 kHz: stored as MHz × 100 (e.g. 12230 = 122.30 MHz).
          legacyFrequencies.push({
            type: this.getFrequencyType(code),
            frequency: parseFloat(token(tokens, 1)) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;
        }

        case RowCode.FREQUENCY_AWOS_833:
        case RowCode.FREQUENCY_CTAF_833:
        case RowCode.FREQUENCY_DELIVERY_833:
        case RowCode.FREQUENCY_GROUND_833:
        case RowCode.FREQUENCY_TOWER_833:
        case RowCode.FREQUENCY_APPROACH_833:
        case RowCode.FREQUENCY_DEPARTURE_833: {
          // Modern 8.33 kHz: stored in kHz (e.g. 122305 = 122.305 MHz).
          modernFrequencies.push({
            type: this.getFrequencyType(code),
            frequency: parseFloat(token(tokens, 1)) / 1000,
            name: tokens.slice(2).join(' '),
          });
          break;
        }

        case RowCode.METADATA:
          {
            const metaKey = tokens[1];
            if (metaKey) airport.metadata[metaKey] = token(tokens, 2);
            break;
          }
          break;

        case RowCode.LAND_RUNWAY: {
          if (tokens.length < 26) {
            this.skipped++;
            break;
          }

          const rawWidth = parseFloat(token(tokens, 1));
          const widthResult = positiveNumber.safeParse(rawWidth);

          const shoulderToken = parseInt(token(tokens, 3));
          let shoulder_surface_type = shoulderToken;
          let shoulder_width = 0;
          if (shoulderToken >= 100) {
            shoulder_width = Math.floor(shoulderToken / 100);
            shoulder_surface_type = shoulderToken % 100;
          }

          const end1 = this.parseRunwayEnd(tokens.slice(8, 17), lineNum);
          const end2 = this.parseRunwayEnd(tokens.slice(17, 26), lineNum);
          if (!end1 || !end2) {
            this.skipped++;
            break;
          }

          airport.runways.push({
            width: widthResult.success ? widthResult.data : 30,
            surface_type: parseInt(token(tokens, 2)),
            shoulder_surface_type,
            shoulder_width,
            smoothness: parseFloat(token(tokens, 4)),
            centerline_lights: Boolean(parseInt(token(tokens, 5))),
            edge_lights: Boolean(parseInt(token(tokens, 6))),
            auto_distance_remaining_signs: Boolean(parseInt(token(tokens, 7))),
            ends: [end1, end2],
          });
          break;
        }

        case RowCode.TAXIWAY: {
          const pathParser = new PathParser(this.lines.slice(i + 1));
          const paths = pathParser.getPaths('polygon');
          if (paths.length > 0) {
            const pavementName = tokens.slice(4).join(' ');

            // Add to taxiways
            airport.taxiways.push({
              surface: parseInt(token(tokens, 1)),
              smoothness: parseFloat(token(tokens, 2)),
              orientation: parseFloat(token(tokens, 3)),
              paths: paths,
            });

            // Also add to pavements
            const pavement = this.parsePavement(tokens, paths);
            if (pavement) airport.pavements.push(pavement);

            // Extract edge markings (painted lines and lights on pavement boundary)
            const edgeFeatures = this.extractPavementEdgeFeatures(pavementName, paths);
            airport.linearFeatures.push(...edgeFeatures);
          }
          // Use getLinesConsumed() for proper index advancement (handles multi-ring pavements)
          i += pathParser.getLinesConsumed();
          break;
        }

        case RowCode.BOUNDARY: {
          const boundaryParser = new PathParser(this.lines.slice(i + 1));
          const boundaryPaths = boundaryParser.getPaths('polygon');
          if (boundaryPaths.length > 0) {
            airport.boundaries.push({ paths: boundaryPaths });
          }
          i += boundaryParser.getLinesConsumed();
          break;
        }

        case RowCode.START_LOCATION_LEGACY: {
          const startupLocation = this.parseStartupLocationLegacy(tokens, lineNum);
          if (startupLocation) airport.startupLocations.push(startupLocation);
          break;
        }

        case RowCode.START_LOCATION_NEW: {
          const startupLocation = this.parseStartupLocation(tokens, lineNum);
          if (startupLocation) airport.startupLocations.push(startupLocation);
          break;
        }

        case RowCode.START_LOCATION_METADATA: {
          // 1301 metadata applies to the previous 1300 startup location
          const lastLocation = airport.startupLocations[airport.startupLocations.length - 1];
          if (lastLocation && tokens.length >= 3) {
            lastLocation.icaoWidthCode = token(tokens, 1);
            lastLocation.operationType = token(tokens, 2);
            // Airlines are optional, tokens[3+] are 3-letter airline codes
            if (tokens.length > 3) {
              lastLocation.airlines = tokens.slice(3);
            }
          }
          break;
        }

        case RowCode.WINDSOCK: {
          const windsock = this.parseWindsock(tokens, lineNum);
          if (windsock) airport.windsocks.push(windsock);
          break;
        }

        case RowCode.TAXI_SIGN: {
          const sign = this.parseSign(tokens, lineNum);
          if (sign) airport.signs.push(sign);
          break;
        }

        case RowCode.FREE_CHAIN: {
          const linearFeatureParser = new PathParser(this.lines.slice(i + 1));
          const linearFeaturePaths = linearFeatureParser.getPaths('line');
          if (linearFeaturePaths.length > 0) {
            const linearFeatures = this.parseLinearFeatures(tokens, linearFeaturePaths);
            airport.linearFeatures.push(...linearFeatures);
          }
          i += linearFeatureParser.getLinesConsumed();
          break;
        }

        case RowCode.TAXI_NETWORK_HEADER:
          // Header row, no data to parse
          break;

        case RowCode.TAXI_NETWORK_NODE: {
          // 1201  lat  lon  usage  id  [name]
          if (tokens.length < 5) break;
          const lat = parseFloat(token(tokens, 1));
          const lon = parseFloat(token(tokens, 2));
          const usage = token(tokens, 3) as import('@/types/apt').TaxiNodeUsage;
          const nodeId = parseInt(token(tokens, 4));
          const nodeName = tokens.length > 5 ? tokens.slice(5).join(' ') : undefined;
          if (
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            Number.isFinite(nodeId) &&
            airport.taxiNetwork
          ) {
            airport.taxiNetwork.nodes.push({
              id: nodeId,
              latitude: lat,
              longitude: lon,
              usage: usage || 'both',
              name: nodeName || undefined,
            });
          }
          break;
        }

        case RowCode.TAXI_NETWORK_EDGE: {
          // 1202  fromId  toId  direction  restriction  name
          if (tokens.length < 5) break;
          const fromId = parseInt(token(tokens, 1));
          const toId = parseInt(token(tokens, 2));
          const direction = token(tokens, 3) as 'oneway' | 'twoway';
          const restriction = token(tokens, 4);
          const edgeName = tokens.slice(5).join(' ').trim();

          // Parse width class from restriction (taxiway_A → 'A', runway → 'runway')
          let widthClass: import('@/types/apt').TaxiWidthClass | 'runway' = 'runway';
          if (restriction && restriction.startsWith('taxiway_')) {
            const cls = restriction.charAt(8).toUpperCase();
            if ('ABCDE'.includes(cls)) {
              widthClass = cls as import('@/types/apt').TaxiWidthClass;
            }
          }

          if (Number.isFinite(fromId) && Number.isFinite(toId) && airport.taxiNetwork) {
            airport.taxiNetwork.edges.push({
              fromNodeId: fromId,
              toNodeId: toId,
              direction: direction || 'twoway',
              widthClass,
              name: edgeName || '',
            });
          }
          break;
        }

        case RowCode.TAXI_NETWORK_ACTIVE_ZONE: {
          // 1204  type  runways (comma-separated)
          // Belongs to the most recently parsed edge
          if (tokens.length < 3 || !airport.taxiNetwork) break;
          const edges = airport.taxiNetwork.edges;
          const parentEdge = edges[edges.length - 1];
          if (!parentEdge) break;

          const zoneType = token(tokens, 1) as import('@/types/apt').ActiveZoneType;
          const runways = token(tokens, 2).split(',').filter(Boolean);

          if (!parentEdge.activeZones) parentEdge.activeZones = [];
          parentEdge.activeZones.push({ type: zoneType, runways });
          break;
        }

        case RowCode.TAXI_NETWORK_TRUCK_EDGE: {
          // 1206  fromId  toId  direction  [name]
          if (tokens.length < 4 || !airport.taxiNetwork) break;
          const fromId = parseInt(token(tokens, 1));
          const toId = parseInt(token(tokens, 2));
          const direction = token(tokens, 3) as 'oneway' | 'twoway';
          const truckEdgeName = tokens.length > 4 ? tokens.slice(4).join(' ').trim() : undefined;
          if (Number.isFinite(fromId) && Number.isFinite(toId)) {
            airport.taxiNetwork.truckEdges.push({
              fromNodeId: fromId,
              toNodeId: toId,
              direction: direction || 'twoway',
              name: truckEdgeName || undefined,
            });
          }
          break;
        }

        case RowCode.TRUCK_PARKING: {
          // 1400  lat  lon  heading  type  extra  [name]
          if (tokens.length < 6 || !airport.taxiNetwork) break;
          const lat = parseFloat(token(tokens, 1));
          const lon = parseFloat(token(tokens, 2));
          const heading = parseFloat(token(tokens, 3));
          const type = token(tokens, 4);
          const extra = parseInt(token(tokens, 5));
          const parkingName = tokens.length > 6 ? tokens.slice(6).join(' ').trim() : undefined;
          if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(heading)) {
            airport.taxiNetwork.truckParkings.push({
              latitude: lat,
              longitude: lon,
              heading,
              type: type || '',
              extra: Number.isFinite(extra) ? extra : 0,
              name: parkingName || undefined,
            });
          }
          break;
        }

        case RowCode.TRUCK_DESTINATION: {
          // 1401  lat  lon  heading  types (pipe-separated)  [name]
          if (tokens.length < 5 || !airport.taxiNetwork) break;
          const lat = parseFloat(token(tokens, 1));
          const lon = parseFloat(token(tokens, 2));
          const heading = parseFloat(token(tokens, 3));
          const types = token(tokens, 4).split('|').filter(Boolean);
          const destName = tokens.length > 5 ? tokens.slice(5).join(' ').trim() : undefined;
          if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(heading)) {
            airport.taxiNetwork.truckDestinations.push({
              latitude: lat,
              longitude: lon,
              heading,
              types,
              name: destName || undefined,
            });
          }
          break;
        }
      }
    }

    // Per the apt.dat 1200 spec: modern (1050-1056) frequency rows supersede
    // legacy (50-56) when both are present. We always prefer modern if any
    // were seen, otherwise fall back to whatever legacy rows existed.
    airport.frequencies = modernFrequencies.length > 0 ? modernFrequencies : legacyFrequencies;

    // Calculate stats
    const parsedCount =
      airport.runways.length +
      airport.taxiways.length +
      airport.startupLocations.length +
      airport.windsocks.length +
      airport.signs.length +
      airport.helipads.length +
      airport.frequencies.length +
      (airport.towerLocation ? 1 : 0) +
      (airport.beacon ? 1 : 0);

    return {
      data: airport,
      errors: this.errors,
      stats: {
        total: this.lines.length,
        parsed: parsedCount,
        skipped: this.skipped,
        timeMs: Date.now() - startTime,
      },
    };
  }
}
