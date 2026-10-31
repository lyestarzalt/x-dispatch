import { describe, expect, it } from 'vitest';
import { liveryAcfMatcher, matchLivery } from './liveryPatterns';

describe('matchLivery', () => {
  it('spots a known aircraft from a folder inside the livery', () => {
    expect(matchLivery('Lufthansa/objects/777/fuselage.png')).toEqual({
      aircraftTypeId: 'FF_B777',
      aircraftName: 'FlightFactor 777v2',
      root: 'Lufthansa/',
    });
  });

  it('spots a known aircraft from a texture name, case-insensitively', () => {
    expect(matchLivery('KLM PH-AOA/Objects/Fuselage320_1.DDS')).toMatchObject({
      aircraftTypeId: 'TOLISS_A320',
      root: 'KLM PH-AOA/',
    });
    expect(matchLivery('objects/738_fuse.png')).toMatchObject({
      aircraftTypeId: 'ZIBO_B738',
      root: '',
    });
  });

  it('falls back to the X-Plane livery icon, which names the .acf', () => {
    expect(matchLivery('N12345/Cessna_172SP_icon11.png')).toEqual({
      aircraftTypeId: 'acf:Cessna_172SP',
      aircraftName: 'Cessna_172SP',
      root: 'N12345/',
    });
    expect(matchLivery('Cessna_172SP_icon11_thumb.png')).toMatchObject({
      aircraftTypeId: 'acf:Cessna_172SP',
      root: '',
    });
  });

  it('prefers the known pattern over the generic icon', () => {
    expect(matchLivery('Air France/a320_icon11.png')).toMatchObject({
      aircraftTypeId: 'TOLISS_A320',
    });
    expect(matchLivery('Ryanair EI-DAC/b738_icon11.png')).toMatchObject({
      aircraftTypeId: 'ZIBO_B738',
      root: 'Ryanair EI-DAC/',
    });
  });

  it('ignores files that are not livery markers', () => {
    expect(matchLivery('readme.txt')).toBeNull();
    expect(matchLivery('objects/wing.obj')).toBeNull();
    expect(matchLivery('icon11.png')).toBeNull();
  });
});

describe('liveryAcfMatcher', () => {
  it('matches the installed aircraft by its .acf name', () => {
    const generic = liveryAcfMatcher('acf:b738');
    expect(generic('b738')).toBe(true);
    expect(generic('B738')).toBe(true);
    expect(generic('b738_xp11')).toBe(false);

    const known = liveryAcfMatcher('LEVELUP_B737');
    expect(known('737_8NG')).toBe(true);
    expect(known('737_900NG')).toBe(false);
    expect(known('b738')).toBe(false);

    const ff = liveryAcfMatcher('FF_B777');
    expect(ff('777-300ER_xp12')).toBe(true);
  });

  it('matches nothing for an unknown id', () => {
    expect(liveryAcfMatcher('NOPE')('b738')).toBe(false);
  });
});
