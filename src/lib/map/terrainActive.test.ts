import { describe, expect, it } from 'vitest';
import { terrainActive } from './terrainActive';

describe('terrainActive', () => {
  it('draws 3D terrain when the pilot has it on and no sim is connected', () => {
    expect(terrainActive({ terrain3dEnabled: true, saveGpuWhileFlying: true }, false)).toBe(true);
  });

  it('suspends it while X-Plane is connected, to leave the video memory to the sim', () => {
    expect(terrainActive({ terrain3dEnabled: true, saveGpuWhileFlying: true }, true)).toBe(false);
  });

  it('keeps it while connected when the saving is off', () => {
    expect(terrainActive({ terrain3dEnabled: true, saveGpuWhileFlying: false }, true)).toBe(true);
  });

  it('never draws it when the pilot has it off', () => {
    expect(terrainActive({ terrain3dEnabled: false, saveGpuWhileFlying: false }, false)).toBe(
      false
    );
  });
});
