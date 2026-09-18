import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HILLSHADE_DIRECTION,
  DEFAULT_HILLSHADE_HIGHLIGHT,
  SKY_KEYFRAMES,
  globeSunLight,
  localSunLight,
  mixHex,
  skyKeyframeAt,
  solarAppearance,
} from './skyPresets';

const HEX = /^#[0-9a-f]{6}$/;

describe('skyKeyframeAt', () => {
  it('returns the exact keyframe at a keyframe altitude', () => {
    for (const key of SKY_KEYFRAMES) {
      const frame = skyKeyframeAt(key.altitude);
      expect(frame.skyColor).toBe(key.skyColor);
      expect(frame.lightIntensity).toBe(key.lightIntensity);
    }
  });

  it('clamps beyond the table', () => {
    expect(skyKeyframeAt(-80).skyColor).toBe(SKY_KEYFRAMES[0]!.skyColor);
    expect(skyKeyframeAt(89).skyColor).toBe(SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1]!.skyColor);
  });

  it('blends halfway between two keyframes', () => {
    // Between -2 and 0 the sky goes from #2d4a7c to #4f7fb6.
    const frame = skyKeyframeAt(-1);
    expect(frame.skyColor).toBe(mixHex('#2d4a7c', '#4f7fb6', 0.5));
    expect(frame.lightIntensity).toBeCloseTo(0.35, 6);
  });

  it('always yields well-formed colours and a brighter day than night', () => {
    let previous = -Infinity;
    for (let alt = -30; alt <= 70; alt += 1) {
      const frame = skyKeyframeAt(alt);
      for (const color of [frame.skyColor, frame.horizonColor, frame.fogColor, frame.lightColor]) {
        expect(color).toMatch(HEX);
      }
      expect(frame.lightIntensity).toBeGreaterThanOrEqual(previous);
      previous = frame.lightIntensity;
    }
  });
});

type Position = [number, number, number];

describe('localSunLight', () => {
  it('places the sun by azimuth and zenith distance in the map frame', () => {
    const light = localSunLight(30, 135);
    expect(light.anchor).toBe('map');
    expect(light.position).toEqual([1.5, 135, 60]);
  });

  it('clamps the sun below the horizon', () => {
    const polar = (altitude: number) => (localSunLight(altitude, 0).position as Position)[2];
    expect(polar(-40)).toBe(130);
    expect(polar(-95)).toBe(180);
  });
});

describe('globeSunLight', () => {
  const position = (lat: number, lon: number) => globeSunLight({ lat, lon }).position as Position;

  it('is anchored to the map so MapLibre rotates it with the globe', () => {
    expect(globeSunLight({ lat: 0, lon: 0 }).anchor).toBe('map');
  });

  it('points straight through the globe for a sun over 0N 0E', () => {
    // MapLibre negates the light to get the sun direction, so the sun at the
    // globe's reference point is the light at the far pole of the frame.
    expect(position(0, 0)[2]).toBeCloseTo(180, 6);
  });

  it('puts the sun over 90E on the eastern horizon of the frame', () => {
    const [, azimuth, polar] = position(0, 90);
    expect(azimuth).toBeCloseTo(90, 6);
    expect(polar).toBeCloseTo(90, 6);
  });

  it('puts the sun over the north pole due south in the frame', () => {
    const [, azimuth, polar] = position(90, 0);
    expect(azimuth).toBeCloseTo(180, 6);
    expect(polar).toBeCloseTo(90, 6);
  });

  it('is antipodal for antipodal subsolar points', () => {
    const [, azA, polarA] = position(20, 40);
    const [, azB, polarB] = position(-20, -140);
    expect((azA + 180) % 360).toBeCloseTo(azB, 6);
    expect(polarA + polarB).toBeCloseTo(180, 6);
  });

  it('uses a full-daylight keyframe for colour and intensity', () => {
    const light = globeSunLight({ lat: 0, lon: 0 });
    expect(light.color).toBe(SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1]!.lightColor);
    expect(light.intensity).toBe(SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1]!.lightIntensity);
  });
});

describe('solarAppearance', () => {
  it('steers the hillshade by the sun while it is up', () => {
    const appearance = solarAppearance(20, 210.4);
    expect(appearance.hillshade['hillshade-illumination-direction']).toBe(210);
    expect(appearance.hillshade['hillshade-highlight-color']).toMatch(HEX);
    expect(appearance.hillshade['hillshade-highlight-color']).not.toBe(DEFAULT_HILLSHADE_HIGHLIGHT);
  });

  it('holds the previous direction and neutral highlight at night', () => {
    const appearance = solarAppearance(-20, 40, 250);
    expect(appearance.hillshade['hillshade-illumination-direction']).toBe(250);
    expect(appearance.hillshade['hillshade-highlight-color']).toBe(DEFAULT_HILLSHADE_HIGHLIGHT);
    expect(solarAppearance(-20, 40).hillshade['hillshade-illumination-direction']).toBe(
      DEFAULT_HILLSHADE_DIRECTION
    );
  });
});
