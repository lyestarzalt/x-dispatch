/**
 * Curated list of X-Plane-relevant FMS download formats SimBrief returns.
 * Each entry maps a SimBrief `fms_downloads.<key>` to a human-readable label.
 * Format labels are proper-noun product names, intentionally not translated.
 */
export interface FmsFormat {
  /** SimBrief `fms_downloads` key (e.g. 'xpn', 'tfd', 'zbo') */
  key: string;
  /** Display label shown in dropdowns and rows */
  label: string;
}

export const FMS_FORMATS: ReadonlyArray<FmsFormat> = [
  { key: 'xpn', label: 'Default X-Plane 12 (.fms)' },
  { key: 'xpe', label: 'X-Plane 11 FMS (.fms)' },
  { key: 'tfd', label: 'ToLiss A319/A321/A340' },
  { key: 'zbo', label: 'Zibo 737' },
  { key: 'ffa', label: 'FlightFactor' },
  { key: 'ixg', label: 'IXEG 737' },
  { key: 'jar', label: 'JARDesign' },
  { key: 'lvd', label: 'Level-D 767' },
  { key: 'psx', label: 'PMDG' },
  { key: 'inb', label: 'Inibuilds' },
  { key: 'mjc', label: 'MilViz' },
  { key: 'gtn', label: 'Garmin GTN (universal)' },
  { key: 'vfp', label: 'VATSIM filed flight plan' },
  { key: 'sfp', label: 'SimpleFlightPlan (universal)' },
  { key: 'pdf', label: 'Briefing PDF' },
];

export function getFmsFormatLabel(key: string): string {
  return FMS_FORMATS.find((f) => f.key === key)?.label ?? key;
}
