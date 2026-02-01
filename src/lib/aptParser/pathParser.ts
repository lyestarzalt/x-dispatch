import { calculateBezier } from './bezier';
import { CoordLineType, LineProps, ParsedPath, RowCode } from './types';

function getSignedArea(coords: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    area += (x2 - x1) * (y2 + y1);
  }
  return area / 2;
}

function isClockwise(coords: [number, number][]): boolean {
  return getSignedArea(coords) < 0;
}

export class PathParser {
  private lines: string[];
  private currentIndex = 0;
  private linesConsumed = 0;
  private bezierResolution: number;

  constructor(content: string[], bezierResolution = 16) {
    this.lines = content;
    this.bezierResolution = bezierResolution;
  }

  getLinesConsumed(): number {
    return this.linesConsumed;
  }

  getPaths(_mode: 'line' | 'polygon' = 'line'): ParsedPath[] {
    const paths: ParsedPath[] = [];
    this.linesConsumed = 0;

    const finalizePath = (
      coordinates: [number, number][],
      properties: LineProps,
      lineTypes: CoordLineType[]
    ) => {
      if (coordinates.length > 0) {
        const isHole = isClockwise(coordinates);
        paths.push({ coordinates, properties, lineTypes, isHole });
      }
    };

    let coordinates: [number, number][] = [];
    let lineTypes: CoordLineType[] = [];
    let properties: LineProps = {};

    let inBezier = false;
    let tempBezierNodes: [number, number][] = [];
    let firstRow: string[] | null = null;
    let firstRowIsBezier = false;

    let currentLineType = 0;
    let currentLightType = 0;

    const addCoord = (coord: [number, number], lineType: number, lightType: number) => {
      coordinates.push(coord);
      lineTypes.push({ lineType, lightType });
    };

    const addBezierSegment = (
      points: [number, number][],
      segmentType: number,
      segmentLight: number,
      endNodeType: number,
      endNodeLight: number
    ) => {
      if (points.length === 0) return;

      // Add all points except the last with the segment's type
      for (let i = 0; i < points.length - 1; i++) {
        addCoord(points[i], segmentType, segmentLight);
      }
      // Add the last point with the ending node's type (for next segment)
      addCoord(points[points.length - 1], endNodeType, endNodeLight);
    };

    const processRow = (isBezier: boolean, tokens: string[]) => {
      const lat = parseFloat(tokens[1]);
      const lon = parseFloat(tokens[2]);
      const coord: [number, number] = [lon, lat];

      if (!isBezier) {
        // Non-bezier node (111, 113, 115)
        const nodeLineType = tokens.length > 3 ? parseInt(tokens[3]) : 0;
        const nodeLightType = tokens.length > 4 ? parseInt(tokens[4]) : 0;

        if (inBezier && tempBezierNodes.length >= 2) {
          // End of bezier sequence - complete the curve
          tempBezierNodes.push(coord);
          if (tempBezierNodes.length === 3) {
            const bezierPoints = calculateBezier(
              tempBezierNodes[0],
              tempBezierNodes[1],
              tempBezierNodes[2],
              this.bezierResolution
            );
            // Segment uses previous node's type, last point uses THIS node's type
            addBezierSegment(
              bezierPoints,
              currentLineType,
              currentLightType,
              nodeLineType,
              nodeLightType
            );
          }
          tempBezierNodes = [];
          inBezier = false;
        } else {
          // Regular non-bezier point
          addCoord(coord, nodeLineType, nodeLightType);
        }

        // Update current type for next segment
        currentLineType = nodeLineType;
        currentLightType = nodeLightType;

        // Track first non-zero type for legacy property
        if (nodeLineType > 0 && properties.painted_line_type === undefined) {
          properties.painted_line_type = nodeLineType;
        }
        if (nodeLightType > 0 && properties.lighting_line_type === undefined) {
          properties.lighting_line_type = nodeLightType;
        }
      } else {
        // Bezier node (112, 114, 116)
        const bzpLat = parseFloat(tokens[3]);
        const bzpLon = parseFloat(tokens[4]);
        const controlPoint: [number, number] = [bzpLon, bzpLat];
        const nodeLineType = tokens.length > 5 ? parseInt(tokens[5]) : 0;
        const nodeLightType = tokens.length > 6 ? parseInt(tokens[6]) : 0;

        if (inBezier && tempBezierNodes.length >= 2) {
          // Continue bezier sequence
          tempBezierNodes.push(coord);
          if (tempBezierNodes.length === 3) {
            const bezierPoints = calculateBezier(
              tempBezierNodes[0],
              tempBezierNodes[1],
              tempBezierNodes[2],
              this.bezierResolution
            );
            // Segment uses previous node's type, last point uses THIS node's type
            addBezierSegment(
              bezierPoints,
              currentLineType,
              currentLightType,
              nodeLineType,
              nodeLightType
            );
            tempBezierNodes = [];
          }
        } else if (coordinates.length > 0) {
          // Start bezier from last point - need to calculate curve to this point
          const diffLat = bzpLat - lat;
          const diffLon = bzpLon - lon;
          const mirrLat = lat - diffLat;
          const mirrLon = lon - diffLon;
          const lastPoint = coordinates[coordinates.length - 1];

          const bezierPoints = calculateBezier(
            lastPoint,
            [mirrLon, mirrLat],
            coord,
            this.bezierResolution
          );
          // Segment uses previous node's type, last point uses THIS node's type
          addBezierSegment(
            bezierPoints,
            currentLineType,
            currentLightType,
            nodeLineType,
            nodeLightType
          );
        }

        // Set up for next bezier segment
        tempBezierNodes = [coord, controlPoint];
        inBezier = true;

        // Update current type for next segment
        currentLineType = nodeLineType;
        currentLightType = nodeLightType;

        // Track first non-zero type for legacy property
        if (nodeLineType > 0 && properties.painted_line_type === undefined) {
          properties.painted_line_type = nodeLineType;
        }
        if (nodeLightType > 0 && properties.lighting_line_type === undefined) {
          properties.lighting_line_type = nodeLightType;
        }
      }
    };

    while (this.currentIndex < this.lines.length) {
      const line = this.lines[this.currentIndex];
      const tokens = line.split(/\s+/);
      const rowCode = parseInt(tokens[0]);

      if (!firstRow) {
        firstRow = tokens;
        firstRowIsBezier = [RowCode.LINE_CURVE, RowCode.RING_CURVE, RowCode.END_CURVE].includes(
          rowCode
        );
      }

      switch (rowCode) {
        case RowCode.LINE_SEGMENT:
          processRow(false, tokens);
          break;
        case RowCode.LINE_CURVE:
          processRow(true, tokens);
          break;
        case RowCode.RING_SEGMENT:
        case RowCode.RING_CURVE:
          // Ring closure - close this path and continue parsing for holes
          processRow(rowCode === RowCode.RING_CURVE, tokens);
          if (firstRow) processRow(firstRowIsBezier, firstRow);
          finalizePath(coordinates, properties, lineTypes);
          this.currentIndex++;
          this.linesConsumed++;
          // Reset for next ring (potential hole)
          coordinates = [];
          lineTypes = [];
          properties = {};
          firstRow = null;
          firstRowIsBezier = false;
          inBezier = false;
          tempBezierNodes = [];
          currentLineType = 0;
          currentLightType = 0;
          continue;
        case RowCode.END_SEGMENT:
        case RowCode.END_CURVE:
          // End of pavement - finalize and return
          processRow(rowCode === RowCode.END_CURVE, tokens);
          finalizePath(coordinates, properties, lineTypes);
          this.currentIndex++;
          this.linesConsumed++;
          return paths;
        default:
          // Non-path row code - another feature starts, return what we have
          return paths;
      }

      this.currentIndex++;
      this.linesConsumed++;
    }

    // End of input - finalize any remaining path
    finalizePath(coordinates, properties, lineTypes);
    return paths;
  }
}
