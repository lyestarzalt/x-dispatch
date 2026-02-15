import type {
  Beacon,
  BoundaryFeature,
  Frequency,
  Helipad,
  LinearFeature,
  ParsedAirport,
  ParsedPath,
  Pavement,
  Runway,
  RunwayEnd,
  Sign,
  StartupLocation,
  TaxiwayFeature,
  TowerLocation,
  Windsock,
} from '@/types/apt';
import { FrequencyType, RowCode } from '@/types/apt';
import { PathParser } from './pathParser';

export class AirportParser {
  private lines: string[];

  constructor(data: string) {
    this.lines = data
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  private parseRunwayEnd(tokens: string[]): RunwayEnd | null {
    if (tokens.length < 9) return null;
    return {
      name: tokens[0],
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
      dthr_length: parseFloat(tokens[3]),
      overrun_length: parseFloat(tokens[4]),
      marking: parseInt(tokens[5]),
      lighting: parseInt(tokens[6]),
      tdz_lighting: Boolean(parseInt(tokens[7])),
      reil: parseInt(tokens[8]),
    };
  }

  private parseStartupLocation(tokens: string[]): StartupLocation | null {
    if (tokens.length < 6) return null;
    return {
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
      heading: parseFloat(tokens[3]),
      location_type: tokens[4],
      airplane_types: tokens[5],
      name: tokens.slice(6).join(' '),
    };
  }

  private parseStartupLocationLegacy(tokens: string[]): StartupLocation | null {
    // Row code 15: legacy format - lat lon heading name
    if (tokens.length < 4) return null;
    return {
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
      heading: parseFloat(tokens[3]),
      location_type: 'misc', // Default type for legacy locations
      airplane_types: 'ABCDEF', // Accept all aircraft types
      name: tokens.slice(4).join(' ') || 'Startup',
    };
  }

  private parseWindsock(tokens: string[]): Windsock | null {
    if (tokens.length < 4) return null;
    return {
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
      illuminated: Boolean(parseInt(tokens[3])),
      name: tokens.slice(4).join(' '),
    };
  }

  private parseSign(tokens: string[]): Sign | null {
    if (tokens.length < 7) return null;
    return {
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
      heading: parseFloat(tokens[3]),
      size: parseInt(tokens[5]),
      text: tokens[6],
    };
  }

  private parsePavement(tokens: string[], paths: ParsedPath[]): Pavement | null {
    if (tokens.length < 4) return null;
    // First path without isHole is the outer boundary, rest are holes
    const outer = paths.find((p) => !p.isHole);
    const holes = paths.filter((p) => p.isHole);

    return {
      surface_type: parseInt(tokens[1]),
      smoothness: parseFloat(tokens[2]),
      texture_orientation: parseFloat(tokens[3]),
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
      let segType = lineTypes[0].lineType;
      let segLight = lineTypes[0].lightType;

      for (let i = 1; i < coordinates.length; i++) {
        const thisType = lineTypes[i].lineType;
        const thisLight = lineTypes[i].lightType;

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

  parse(): ParsedAirport {
    const airport: ParsedAirport = {
      id: '',
      name: '',
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
    };

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const tokens = line.split(/\s+/);
      const code = parseInt(tokens[0]);

      switch (code) {
        case RowCode.AIRPORT_HEADER:
          airport.elevation = parseFloat(tokens[1]);
          airport.id = tokens[4];
          airport.name = tokens.slice(5).join(' ');
          break;

        case RowCode.TOWER_LOCATION:
          airport.towerLocation = {
            latitude: parseFloat(tokens[1]),
            longitude: parseFloat(tokens[2]),
            height: parseFloat(tokens[3]),
            name: tokens.slice(4).join(' '),
          };
          break;

        case RowCode.BEACON:
          airport.beacon = {
            latitude: parseFloat(tokens[1]),
            longitude: parseFloat(tokens[2]),
            type: parseInt(tokens[3]),
            name: tokens.slice(4).join(' '),
          };
          break;

        case RowCode.HELIPAD: {
          const helipad: Helipad = {
            name: tokens[1],
            latitude: parseFloat(tokens[2]),
            longitude: parseFloat(tokens[3]),
            heading: parseFloat(tokens[4]),
            length: parseFloat(tokens[5]),
            width: parseFloat(tokens[6]),
            surface_type: parseInt(tokens[7]),
          };
          airport.helipads.push(helipad);
          break;
        }

        case RowCode.FREQUENCY_AWOS:
          airport.frequencies.push({
            type: FrequencyType.AWOS,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_CTAF:
          airport.frequencies.push({
            type: FrequencyType.CTAF,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_DELIVERY:
          airport.frequencies.push({
            type: FrequencyType.DELIVERY,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_GROUND:
          airport.frequencies.push({
            type: FrequencyType.GROUND,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_TOWER:
          airport.frequencies.push({
            type: FrequencyType.TOWER,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_APPROACH:
          airport.frequencies.push({
            type: FrequencyType.APPROACH,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_CENTER:
          airport.frequencies.push({
            type: FrequencyType.CENTER,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.FREQUENCY_UNICOM:
          airport.frequencies.push({
            type: FrequencyType.UNICOM,
            frequency: parseFloat(tokens[1]) / 100,
            name: tokens.slice(2).join(' '),
          });
          break;

        case RowCode.METADATA:
          airport.metadata[tokens[1]] = tokens[2];
          break;

        case RowCode.LAND_RUNWAY: {
          if (tokens.length < 26) break; // Not enough tokens for runway
          // Token[3] encodes shoulder info:
          // If value >= 100: width = floor(value / 100) meters, surface = value % 100
          // If value < 100: just surface type (0=none, 1=asphalt, 2=concrete)
          const shoulderToken = parseInt(tokens[3]);
          let shoulder_surface_type = shoulderToken;
          let shoulder_width = 0;
          if (shoulderToken >= 100) {
            shoulder_width = Math.floor(shoulderToken / 100);
            shoulder_surface_type = shoulderToken % 100;
          }

          const end1 = this.parseRunwayEnd(tokens.slice(8, 17));
          const end2 = this.parseRunwayEnd(tokens.slice(17, 26));
          if (!end1 || !end2) break; // Invalid runway end data

          const runway: Runway = {
            width: parseFloat(tokens[1]),
            surface_type: parseInt(tokens[2]),
            shoulder_surface_type,
            shoulder_width,
            smoothness: parseFloat(tokens[4]),
            centerline_lights: Boolean(parseInt(tokens[5])),
            edge_lights: Boolean(parseInt(tokens[6])),
            auto_distance_remaining_signs: Boolean(parseInt(tokens[7])),
            ends: [end1, end2],
          };
          airport.runways.push(runway);
          break;
        }

        case RowCode.TAXIWAY: {
          const pathParser = new PathParser(this.lines.slice(i + 1));
          const paths = pathParser.getPaths('polygon');
          if (paths.length > 0) {
            const pavementName = tokens.slice(4).join(' ');

            // Add to taxiways
            airport.taxiways.push({
              surface: parseInt(tokens[1]),
              smoothness: parseFloat(tokens[2]),
              orientation: parseFloat(tokens[3]),
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
          const startupLocation = this.parseStartupLocationLegacy(tokens);
          if (startupLocation) airport.startupLocations.push(startupLocation);
          break;
        }

        case RowCode.START_LOCATION_NEW: {
          const startupLocation = this.parseStartupLocation(tokens);
          if (startupLocation) airport.startupLocations.push(startupLocation);
          break;
        }

        case RowCode.WINDSOCK: {
          const windsock = this.parseWindsock(tokens);
          if (windsock) airport.windsocks.push(windsock);
          break;
        }

        case RowCode.TAXI_SIGN: {
          const sign = this.parseSign(tokens);
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
      }
    }

    return airport;
  }
}
