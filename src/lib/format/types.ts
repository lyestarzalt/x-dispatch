/**
 * Unit preference types for user settings
 */

export type WeightUnit = 'lbs' | 'kg';

export interface UnitPreferences {
  weight: WeightUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  weight: 'lbs', // X-Plane default
};
