import { describe, expect, it } from 'vitest';
import { PathParser } from './pathParser';

// ---------------------------------------------------------------------------
// Plain path (no bezier)
// ---------------------------------------------------------------------------

describe('PathParser — plain path', () => {
  it('parses 4 plain vertices ending with 115', () => {
    const lines = [
      '111  40.640000 -73.780000',
      '111  40.641000 -73.780000',
      '111  40.641000 -73.779000',
      '115  40.640000 -73.779000',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('polygon');

    expect(paths).toHaveLength(1);
    expect(paths[0]!.coordinates).toHaveLength(4);
  });

  it('coordinates match the parsed lat/lon in [lon, lat] order', () => {
    const lines = ['111  40.640000 -73.780000', '115  40.641000 -73.779000'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');

    const coords = paths[0]!.coordinates;
    expect(coords[0]![0]).toBeCloseTo(-73.78, 5);
    expect(coords[0]![1]).toBeCloseTo(40.64, 5);
    expect(coords[1]![0]).toBeCloseTo(-73.779, 5);
    expect(coords[1]![1]).toBeCloseTo(40.641, 5);
  });

  it('linesConsumed equals number of rows consumed', () => {
    const lines = [
      '111  40.640000 -73.780000',
      '111  40.641000 -73.780000',
      '115  40.641000 -73.779000',
    ];
    const parser = new PathParser(lines);
    parser.getPaths('line');
    expect(parser.getLinesConsumed()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Bezier path (112 nodes)
// ---------------------------------------------------------------------------

describe('PathParser — bezier path', () => {
  it('bezier path produces more points than the raw vertex count', () => {
    // 3 raw vertices: plain, bezier, plain-end → bezier interpolation adds intermediate points
    const lines = [
      '111  40.640000 -73.780000',
      '112  40.641000 -73.780000  40.6405 -73.7795',
      '115  40.642000 -73.780000',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');

    expect(paths).toHaveLength(1);
    expect(paths[0]!.coordinates.length).toBeGreaterThan(3);
  });

  it('bezier path starts at first vertex and ends at last vertex', () => {
    const lines = [
      '111  40.640000 -73.780000',
      '112  40.641000 -73.780000  40.6405 -73.7795',
      '115  40.642000 -73.780000',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    const coords = paths[0]!.coordinates;

    expect(coords[0]![0]).toBeCloseTo(-73.78, 5);
    expect(coords[0]![1]).toBeCloseTo(40.64, 5);
    expect(coords[coords.length - 1]![0]).toBeCloseTo(-73.78, 5);
    expect(coords[coords.length - 1]![1]).toBeCloseTo(40.642, 5);
  });
});

// ---------------------------------------------------------------------------
// Ring closure (113)
// ---------------------------------------------------------------------------

describe('PathParser — ring closure (113)', () => {
  it('ring path closes first==last coordinate', () => {
    const lines = [
      '111  40.640000 -73.780000',
      '111  40.641000 -73.780000',
      '111  40.641000 -73.779000',
      '113  40.640000 -73.779000',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('polygon');

    expect(paths).toHaveLength(1);
    const coords = paths[0]!.coordinates;
    expect(coords.length).toBeGreaterThanOrEqual(4);

    // Ring is closed: first coord repeated at end
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    expect(first[0]).toBeCloseTo(last[0], 5);
    expect(first[1]).toBeCloseTo(last[1], 5);
  });

  it('ring closure produces exactly n+1 coordinates (closing vertex appended)', () => {
    // 4 distinct vertices + ring closure repeats the first one = 5 coords
    const lines = [
      '111  40.640000 -73.780000',
      '111  40.641000 -73.780000',
      '111  40.641000 -73.779000',
      '113  40.640000 -73.779000',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('polygon');
    // ring-close (113) appends the 113 vertex AND re-appends the first vertex
    // resulting in 5 coords (4 unique + 1 closing duplicate of the first)
    expect(paths[0]!.coordinates).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Hole detection (isHole via signed area / clockwise winding)
// ---------------------------------------------------------------------------

describe('PathParser — isHole detection', () => {
  // PathParser's isHole uses getSignedArea: sum += (x2-x1)*(y2+y1), area/2
  // where x=lon, y=lat. When area < 0 → isHole = true.
  // The sign convention with this specific trapezoid formula is verified empirically below.
  it('ring A produces isHole = true (negative signed area)', () => {
    // Winding: [0,0]→[0,1]→[1,1]→[1,0] (parsed as lon/lat tokens: "lat lon")
    // tokens: "111 lat lon" → coord = [lon, lat]
    // "111  0.0  0.0" → lat=0, lon=0 → coord=[0,0]
    // "111  0.0  1.0" → lat=0, lon=1 → coord=[1,0]
    // "111  1.0  1.0" → lat=1, lon=1 → coord=[1,1]
    // "113  1.0  0.0" → lat=1, lon=0 → coord=[0,1]
    const lines = ['111  0.0  0.0', '111  0.0  1.0', '111  1.0  1.0', '113  1.0  0.0'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('polygon');
    expect(paths[0]!.isHole).toBe(true);
  });

  it('ring B produces isHole = false (positive signed area)', () => {
    // Winding: [0,0]→[0,1]→[1,1]→[1,0] reversed
    // "111  0.0  0.0" → coord=[0,0]
    // "111  1.0  0.0" → coord=[0,1]
    // "111  1.0  1.0" → coord=[1,1]
    // "113  0.0  1.0" → coord=[1,0]
    const lines = ['111  0.0  0.0', '111  1.0  0.0', '111  1.0  1.0', '113  0.0  1.0'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('polygon');
    expect(paths[0]!.isHole).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Line type parsing
// ---------------------------------------------------------------------------

describe('PathParser — line type parsing', () => {
  it('parses lineType and lightType per coordinate from 111 nodes', () => {
    const lines = [
      '111  40.640000 -73.780000  1  101',
      '111  40.641000 -73.780000  2  102',
      '115  40.642000 -73.780000  0  0',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    const { lineTypes } = paths[0]!;

    expect(lineTypes).toHaveLength(3);
    expect(lineTypes![0]).toEqual({ lineType: 1, lightType: 101 });
    expect(lineTypes![1]).toEqual({ lineType: 2, lightType: 102 });
    expect(lineTypes![2]).toEqual({ lineType: 0, lightType: 0 });
  });

  it('sets painted_line_type property from first non-zero lineType', () => {
    const lines = [
      '111  40.640000 -73.780000  0  0',
      '111  40.641000 -73.780000  3  0',
      '115  40.642000 -73.780000  5  0',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    // First non-zero lineType is 3
    expect(paths[0]!.properties.painted_line_type).toBe(3);
  });

  it('sets lighting_line_type property from first non-zero lightType', () => {
    const lines = [
      '111  40.640000 -73.780000  0  0',
      '111  40.641000 -73.780000  0  103',
      '115  40.642000 -73.780000  0  104',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    // First non-zero lightType is 103
    expect(paths[0]!.properties.lighting_line_type).toBe(103);
  });

  it('single token >= 100 is treated as lightType, not lineType', () => {
    const lines = ['111  40.640000 -73.780000  101', '115  40.641000 -73.780000'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    expect(paths[0]!.lineTypes![0]).toEqual({ lineType: 0, lightType: 101 });
  });

  it('single token < 100 is treated as lineType, not lightType', () => {
    const lines = ['111  40.640000 -73.780000  5', '115  40.641000 -73.780000'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    expect(paths[0]!.lineTypes![0]).toEqual({ lineType: 5, lightType: 0 });
  });
});

// ---------------------------------------------------------------------------
// Multiple rings (main + hole)
// ---------------------------------------------------------------------------

describe('PathParser — multiple rings', () => {
  it('parses two rings from a 113 followed by another ring', () => {
    const lines = [
      // First ring (outer)
      '111  0.0  0.0',
      '111  0.0  2.0',
      '111  2.0  2.0',
      '113  2.0  0.0',
      // Second ring (hole — note CW winding)
      '111  0.5  0.5',
      '111  1.5  0.5',
      '111  1.5  1.5',
      '113  0.5  1.5',
    ];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('polygon');
    expect(paths).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('PathParser — edge cases', () => {
  it('empty input produces no paths', () => {
    const parser = new PathParser([]);
    const paths = parser.getPaths('line');
    expect(paths).toHaveLength(0);
  });

  it('non-path row code at start returns empty paths', () => {
    const lines = ['100  some  data'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    expect(paths).toHaveLength(0);
  });

  it('single 115 vertex produces 1-point path', () => {
    const lines = ['115  40.640000 -73.780000'];
    const parser = new PathParser(lines);
    const paths = parser.getPaths('line');
    expect(paths).toHaveLength(1);
    expect(paths[0]!.coordinates).toHaveLength(1);
  });
});
