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
  /**
   * Filename this addon requires, when it reads a fixed path rather than scanning
   * the folder. Overrides the name derived from the OFP. Leave unset for formats
   * that accept any filename.
   */
  fixedFilename?: string;
}

export const FMS_FORMATS: ReadonlyArray<FmsFormat> = [
  { key: 'xpn', label: 'Default X-Plane 12 (.fms)' },
  { key: 'xpe', label: 'X-Plane 11 FMS (.fms)' },
  { key: 'tfd', label: 'ToLiss A319/A321/A340' },
  { key: 'zbo', label: 'Zibo 737', fixedFilename: 'b738x.xml' },
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

/**
 * The filename a format insists on, or undefined when any name will do.
 *
 * Zibo's datalink reads a hardcoded `Output/FMS plans/b738x.xml` and does not scan the
 * folder, so an export named after the OFP is never found — and Zibo reports nothing,
 * the request simply does nothing.
 */
export function getFmsFixedFilename(key: string): string | undefined {
  return FMS_FORMATS.find((f) => f.key === key)?.fixedFilename;
}
