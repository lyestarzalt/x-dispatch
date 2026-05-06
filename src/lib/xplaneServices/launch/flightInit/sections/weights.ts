import type { Aircraft } from '@/types/aircraft';

const LBS_TO_KG = 0.453592;

/**
 * Convert per-tank fuel percentages (0-100) into the kg array X-Plane expects
 * in `weight.fueltank_weight_in_kilograms`. Uses the aircraft's tank ratios,
 * indices, and maxFuel from its .acf metadata. Output is always length 9
 * (XP's max), zero-padded for unused slots.
 */
export function calculateFuelTankWeightsKg(
  aircraft: Aircraft,
  tankPercentages: number[]
): number[] {
  const tankWeightsKg = new Array(9).fill(0);
  const ratios = aircraft.tankRatios ?? [];
  const indices = aircraft.tankIndices ?? ratios.map((_, i) => i);
  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i];
    if (ratio === undefined) continue;
    const tankCapLbs = ratio * aircraft.maxFuel;
    const slot = indices[i] ?? i;
    tankWeightsKg[slot] = tankCapLbs * ((tankPercentages[i] ?? 0) / 100) * LBS_TO_KG;
  }
  return tankWeightsKg;
}

/**
 * Convert per-station payload weights from lbs to kg, padded to 9 slots
 * to match XP's `weight.payload_weight_in_kilograms` array shape.
 */
export function calculatePayloadWeightsKg(payloadWeightsLbs: number[]): number[] {
  const out = new Array(9).fill(0);
  for (let i = 0; i < payloadWeightsLbs.length; i++) {
    out[i] = (payloadWeightsLbs[i] ?? 0) * LBS_TO_KG;
  }
  return out;
}
