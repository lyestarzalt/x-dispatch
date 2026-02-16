import { z } from 'zod';
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
import { bearing, coordinate, latitude, longitude, nonNegative, positiveNumber } from '../schemas';
import type { ParseError, ParseResult } from '../types';
import { PathParser } from './pathParser';

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
  private currentLine = 0;

  constructor(data: string) {
    this.lines = data
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  /**
   * Map row code to frequency type
   */
  private getFrequencyType(code: number): FrequencyType {
    switch (code) {
      case RowCode.FREQUENCY_AWOS:
        return FrequencyType.AWOS;
      case RowCode.FREQUENCY_CTAF:
        return FrequencyType.CTAF;
      case RowCode.FREQUENCY_DELIVERY:
        return FrequencyType.DELIVERY;
      case RowCode.FREQUENCY_GROUND:
        return FrequencyType.GROUND;
      case RowCode.FREQUENCY_TOWER:
        return FrequencyType.TOWER;
      case RowCode.FREQUENCY_APPROACH:
        return FrequencyType.APPROACH;
      case RowCode.FREQUENCY_CENTER:
        return FrequencyType.CENTER;
      case RowCode.FREQUENCY_UNICOM:
        return FrequencyType.UNICOM;
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
      name: tokens[0],
      lat: parseFloat(tokens[1]),
      lon: parseFloat(tokens[2]),
      dthr_length: Math.max(0, parseFloat(tokens[3]) || 0),
      overrun_length: Math.max(0, parseFloat(tokens[4]) || 0),
      marking: parseInt(tokens[5]),
      lighting: parseInt(tokens[6]),
      tdz_lighting: Boolean(parseInt(tokens[7])),
      reil: parseInt(tokens[8]),
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

    const rawHeading = parseFloat(tokens[3]);
    const result = StartupLocationSchema.safeParse({
      lat: parseFloat(tokens[1]),
      lon: parseFloat(tokens[2]),
      heading: rawHeading >= 0 && rawHeading <= 360 ? rawHeading : 0,
      location_type: tokens[4],
      airplane_types: tokens[5],
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

    const rawHeading = parseFloat(tokens[3]);
    const result = StartupLocationSchema.safeParse({
      lat: parseFloat(tokens[1]),
      lon: parseFloat(tokens[2]),
      heading: rawHeading >= 0 && rawHeading <= 360 ? rawHeading : 0,
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
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
    });

    if (!result.success) {
      this.skipped++;
      return null;
    }

    return {
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      illuminated: Boolean(parseInt(tokens[3])),
      name: tokens.slice(4).join(' '),
    };
  }

  private parseSign(tokens: string[], lineNum: number): Sign | null {
    if (tokens.length < 7) {
      this.skipped++;
      return null;
    }

    const rawHeading = parseFloat(tokens[3]);
    const coordResult = coordinate.safeParse({
      latitude: parseFloat(tokens[1]),
      longitude: parseFloat(tokens[2]),
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

  parse(): ParseResult<ParsedAirport> {
    const startTime = Date.now();
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
      const lineNum = i + 1; // 1-indexed for human readability
      const line = this.lines[i];
      const tokens = line.split(/\s+/);
      const code = parseInt(tokens[0]);

      switch (code) {
        case RowCode.AIRPORT_HEADER: {
          const elevation = parseFloat(tokens[1]);
          airport.elevation = Number.isFinite(elevation) ? elevation : 0;
          airport.id = tokens[4] || '';
          airport.name = tokens.slice(5).join(' ');
          break;
        }

        case RowCode.TOWER_LOCATION: {
          const lat = parseFloat(tokens[1]);
          const lon = parseFloat(tokens[2]);
          const height = parseFloat(tokens[3]);

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
          const lat = parseFloat(tokens[1]);
          const lon = parseFloat(tokens[2]);

          if (this.validateCoordinate(lat, lon, 'beacon', lineNum)) {
            airport.beacon = {
              latitude: lat,
              longitude: lon,
              type: parseInt(tokens[3]),
              name: tokens.slice(4).join(' '),
            };
          }
          break;
        }

        case RowCode.HELIPAD: {
          const lat = parseFloat(tokens[2]);
          const lon = parseFloat(tokens[3]);
          const rawHeading = parseFloat(tokens[4]);
          const rawLength = parseFloat(tokens[5]);
          const rawWidth = parseFloat(tokens[6]);

          const coordResult = coordinate.safeParse({ latitude: lat, longitude: lon });
          if (!coordResult.success) {
            this.skipped++;
            break;
          }

          const headingResult = bearing.safeParse(rawHeading);
          const lengthResult = positiveNumber.safeParse(rawLength);
          const widthResult = positiveNumber.safeParse(rawWidth);

          airport.helipads.push({
            name: tokens[1],
            latitude: lat,
            longitude: lon,
            heading: headingResult.success ? headingResult.data : 0,
            length: lengthResult.success ? lengthResult.data : 1,
            width: widthResult.success ? widthResult.data : 1,
            surface_type: parseInt(tokens[7]),
          });
          break;
        }

        case RowCode.FREQUENCY_AWOS:
        case RowCode.FREQUENCY_CTAF:
        case RowCode.FREQUENCY_DELIVERY:
        case RowCode.FREQUENCY_GROUND:
        case RowCode.FREQUENCY_TOWER:
        case RowCode.FREQUENCY_APPROACH:
        case RowCode.FREQUENCY_CENTER:
        case RowCode.FREQUENCY_UNICOM: {
          const freqType = this.getFrequencyType(code);
          const freq = parseFloat(tokens[1]) / 100;
          airport.frequencies.push({
            type: freqType,
            frequency: freq,
            name: tokens.slice(2).join(' '),
          });
          break;
        }

        case RowCode.METADATA:
          airport.metadata[tokens[1]] = tokens[2];
          break;

        case RowCode.LAND_RUNWAY: {
          if (tokens.length < 26) {
            this.skipped++;
            break;
          }

          const rawWidth = parseFloat(tokens[1]);
          const widthResult = positiveNumber.safeParse(rawWidth);

          const shoulderToken = parseInt(tokens[3]);
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
            surface_type: parseInt(tokens[2]),
            shoulder_surface_type,
            shoulder_width,
            smoothness: parseFloat(tokens[4]),
            centerline_lights: Boolean(parseInt(tokens[5])),
            edge_lights: Boolean(parseInt(tokens[6])),
            auto_distance_remaining_signs: Boolean(parseInt(tokens[7])),
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
          const startupLocation = this.parseStartupLocationLegacy(tokens, lineNum);
          if (startupLocation) airport.startupLocations.push(startupLocation);
          break;
        }

        case RowCode.START_LOCATION_NEW: {
          const startupLocation = this.parseStartupLocation(tokens, lineNum);
          if (startupLocation) airport.startupLocations.push(startupLocation);
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
      }
    }

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
