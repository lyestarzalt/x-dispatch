import { describe, expect, it } from 'vitest';
import { parseHoldingPatterns } from './holdParser';

const header = 'I\n1140 Version - data cycle 2610\n\n';
const parse = (line: string) => parseHoldingPatterns(`${header}${line}\n99\n`);

describe('parseHoldingPatterns', () => {
  it('reads a hold with a ceiling', () => {
    const hold = parse('AE712 DA DAAE 11 31.0 1.0 0.0 R 10000 14000 210').data[0]!;
    expect(hold).toMatchObject({
      fixId: 'AE712',
      airport: 'DAAE',
      inboundCourse: 31,
      legTime: 1,
      turnDirection: 'R',
      minAlt: 10000,
      maxAlt: 14000,
      speedKts: 210,
    });
  });

  it('does not mistake a first hold starting with A for the header', () => {
    const result = parse('AE701 DA DAAE 11 171.0 1.0 0.0 R 5577 14000 230');
    expect(result.stats.skipped).toBe(0);
    expect(result.data[0]?.fixId).toBe('AE701');
  });

  it('keeps a hold with no ceiling, stored as 0', () => {
    const result = parse('MAR DA DAAG 2 70.0 1.0 0.0 L 3937 0 220');
    expect(result.stats.skipped).toBe(0);
    expect(result.data[0]?.maxAlt).toBe(0);
  });

  it('keeps a hold in upper airspace', () => {
    const result = parse('ABC LE LEMD 11 90.0 1.0 0.0 R 24500 66000 0');
    expect(result.stats.skipped).toBe(0);
    expect(result.data[0]?.maxAlt).toBe(66000);
  });

  it('reports the line and reason of a skipped hold', () => {
    const result = parse('ABC LE LEMD 11 90.0 1.0 0.0 X 24500 66000 0');
    expect(result.data).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(4);
    expect(result.errors[0]?.message).toContain('turnDirection');
  });
});
