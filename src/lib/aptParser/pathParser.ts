import type { LonLat } from '@/types/geo';
import { calculateBezier, calculateCubicBezier, mirrorControlPoint } from './bezier';
import { CoordLineType, LineProps, ParsedPath, RowCode } from './types';

function getSignedArea(coords: LonLat[]): number {
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    area += (x2 - x1) * (y2 + y1);
  }
  return area / 2;
}

function isClockwise(coords: LonLat[]): boolean {
  return getSignedArea(coords) < 0;
}

export class PathParser {
  private lines: string[];
  private currentIndex = 0;
  private linesConsumed = 0;

  constructor(content: string[]) {
    this.lines = content;
  }

  getLinesConsumed(): number {
    return this.linesConsumed;
  }

  getPaths(_mode: 'line' | 'polygon' = 'line'): ParsedPath[] {
    const paths: ParsedPath[] = [];
    this.linesConsumed = 0;

    const finalizePath = (
      coordinates: LonLat[],
      properties: LineProps,
      lineTypes: CoordLineType[]
    ) => {
      if (coordinates.length > 0) {
        const isHole = isClockwise(coordinates);
        paths.push({ coordinates, properties, lineTypes, isHole });
      }
    };

    let coordinates: LonLat[] = [];
    let lineTypes: CoordLineType[] = [];
    let properties: LineProps = {};

    let inBezier = false;
    let tempBezierNodes: LonLat[] = [];
    let firstRow: string[] | null = null;
    let firstRowIsBezier = false;

    let currentLineType = 0;
    let currentLightType = 0;

    const addCoord = (coord: LonLat, lineType: number, lightType: number) => {
      coordinates.push(coord);
      lineTypes.push({ lineType, lightType });
    };

    const addBezierSegment = (
      points: LonLat[],
      segmentType: number,
      segmentLight: number,
      endNodeType: number,
      endNodeLight: number
    ) => {
      if (points.length === 0) return;

      const lastCoord = coordinates[coordinates.length - 1];
      const firstPoint = points[0];
      const startIndex =
        lastCoord && lastCoord[0] === firstPoint[0] && lastCoord[1] === firstPoint[1] ? 1 : 0;

      for (let i = startIndex; i < points.length - 1; i++) {
        addCoord(points[i], segmentType, segmentLight);
      }
      addCoord(points[points.length - 1], endNodeType, endNodeLight);
    };

    const processRow = (isBezier: boolean, tokens: string[]) => {
      const lat = parseFloat(tokens[1]);
      const lon = parseFloat(tokens[2]);
      const coord: LonLat = [lon, lat];

      if (!isBezier) {
        // Non-bezier node (111, 113, 115)
        const nodeLineType = tokens.length > 3 ? parseInt(tokens[3]) : 0;
        const nodeLightType = tokens.length > 4 ? parseInt(tokens[4]) : 0;

        if (inBezier && tempBezierNodes.length >= 2) {
          // End of bezier sequence - complete the curve (112 → 111 case)
          const p0 = tempBezierNodes[0];

          // Check for split bezier (same vertex) - skip curve if same position
          if (p0[0] === coord[0] && p0[1] === coord[1]) {
            // Same position - this is a split bezier, don't draw curve to self
            // But still add the coordinate with its type for the next segment
            addCoord(coord, nodeLineType, nodeLightType);
          } else {
            const bezierPoints = calculateBezier(p0, tempBezierNodes[1], coord);
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
        const controlPoint: LonLat = [bzpLon, bzpLat];
        const nodeLineType = tokens.length > 5 ? parseInt(tokens[5]) : 0;
        const nodeLightType = tokens.length > 6 ? parseInt(tokens[6]) : 0;

        if (inBezier && tempBezierNodes.length >= 2) {
          // 112 → 112 case: CUBIC bezier
          const p0 = tempBezierNodes[0];
          const p3 = coord;

          // Check for split bezier (same vertex with different controls) - skip curve if same position
          if (p0[0] === p3[0] && p0[1] === p3[1]) {
            // Same position - this is a split bezier, don't draw curve to self
            // But still add the coordinate with its type for the next segment
            addCoord(coord, nodeLineType, nodeLightType);
          } else {
            const p1 = tempBezierNodes[1];
            const p2 = mirrorControlPoint(p3, controlPoint);

            const bezierPoints = calculateCubicBezier(p0, p1, p2, p3);
            addBezierSegment(
              bezierPoints,
              currentLineType,
              currentLightType,
              nodeLineType,
              nodeLightType
            );
          }
        } else if (coordinates.length > 0) {
          // 111 → 112 case: Quadratic bezier with mirrored control point
          const lastPoint = coordinates[coordinates.length - 1];

          // Check for split bezier (same vertex) - skip curve if same position
          if (lastPoint[0] === coord[0] && lastPoint[1] === coord[1]) {
            // Same position - this is a split bezier, don't draw curve to self
            // But still add the coordinate with its type for the next segment
            addCoord(coord, nodeLineType, nodeLightType);
          } else {
            const mirroredControl = mirrorControlPoint(coord, controlPoint);
            const bezierPoints = calculateBezier(lastPoint, mirroredControl, coord);
            addBezierSegment(
              bezierPoints,
              currentLineType,
              currentLightType,
              nodeLineType,
              nodeLightType
            );
          }
        }

        // Set up for next bezier segment (outgoing control point)
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
