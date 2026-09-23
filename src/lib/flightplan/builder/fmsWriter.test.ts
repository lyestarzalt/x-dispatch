import { describe, expect, it } from 'vitest';
import { parseFMSFile } from '@/lib/parsers/fms';
import type { FMSFlightPlan } from '@/types/fms';
import { fmsFileStem, serializeFms } from './fmsWriter';

const plan: FMSFlightPlan = {
  version: 1100,
  cycle: '2409',
  departure: { icao: 'EHAM', runway: '36C', sid: 'ARNEM2S' },
  arrival: { icao: 'EDDF', runway: 'RW25L', star: 'UNOKO1A', approach: 'I25L' },
  waypoints: [
    { type: 1, id: 'EHAM', via: 'ADEP', altitude: 0, latitude: 52.3086, longitude: 4.7639 },
    { type: 11, id: 'ARNEM', via: 'DRCT', altitude: 29000, latitude: 51.9789, longitude: 5.7942 },
    { type: 3, id: 'OSN', via: 'UL620', altitude: 29000, latitude: 52.2049, longitude: 8.2853 },
    { type: 1, id: 'EDDF', via: 'ADES', altitude: 0, latitude: 50.0333, longitude: 8.5706 },
  ],
};

describe('serializeFms', () => {
  it('round-trips through the parser', () => {
    const text = serializeFms(plan);
    const parsed = parseFMSFile(text);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.departure).toEqual({ icao: 'EHAM', runway: '36C', sid: 'ARNEM2S' });
    expect(parsed.data?.arrival.runway).toBe('25L');
    expect(parsed.data?.arrival.approach).toBe('I25L');
    expect(parsed.data?.waypoints).toHaveLength(4);
    expect(parsed.data?.waypoints[2]?.via).toBe('UL620');
  });

  it('writes the header in X-Plane order and prefixes runways with RW', () => {
    const lines = serializeFms(plan).split('\n');
    expect(lines.slice(0, 5)).toEqual([
      'I',
      '1100 Version',
      'CYCLE 2409',
      'ADEP EHAM',
      'DEPRWY RW36C',
    ]);
    expect(lines).toContain('DESRWY RW25L');
    expect(lines).toContain('NUMENR 4');
  });

  it('leaves out STAR and approach when no destination runway is known', () => {
    const lines = serializeFms({
      ...plan,
      arrival: { icao: 'EDDF', star: 'UNOKO1A', approach: 'I25L' },
    }).split('\n');
    expect(lines).not.toContain('STAR UNOKO1A');
    expect(lines).not.toContain('APP I25L');
    expect(lines).toContain('ADES EDDF');
  });

  it('builds a safe file stem', () => {
    expect(fmsFileStem('eham', 'ed/df', '01')).toBe('EHAMEDDF01');
  });
});
