/**
 * Whether the map draws 3D terrain right now.
 *
 * Terrain is the bulk of the map's video memory: measured over LOWI at 1.8×,
 * tilting to 70° took the GPU process from about 680 to 1,160–1,410 MB with
 * terrain and from about 350 to 410–450 MB without (2026-11-10). While
 * X-Plane is connected that memory is the sim's, so terrain is suspended
 * unless the pilot turned the saving off. Their terrain setting is untouched.
 */
export function terrainActive(
  settings: { terrain3dEnabled: boolean; saveGpuWhileFlying: boolean },
  simConnected: boolean
): boolean {
  if (!settings.terrain3dEnabled) return false;
  return !(settings.saveGpuWhileFlying && simConnected);
}
