import { fmsFileStem } from '@/lib/flightplan/builder/fmsWriter';
import type { SimBriefOFP } from '@/types/simbrief';

/**
 * Add-ons that load one hard-coded file instead of scanning the FMS folder.
 * Their export must use exactly this name or the add-on never sees it.
 */
const REQUIRED_NAMES: Readonly<Record<string, string>> = {
  // Zibo 737 only reads Output/FMS plans/b738x.xml.
  zbo: 'b738x.xml',
};

/**
 * Extension of the file behind a SimBrief download link, e.g. ".fms".
 * SimBrief marks a link that reuses another format's file with a "--XYZ" suffix
 * after the extension (`plan.xml--ZBO`), so everything from "--" on is ignored.
 */
function linkExtension(link: string): string {
  const lastSegment = link.split(/[?#]/)[0]?.split('/').pop() ?? '';
  const fileName = lastSegment.split('--')[0] ?? '';
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return '';
  const extension = fileName.slice(dot);
  return /^\.[a-z0-9]+$/i.test(extension) ? extension : '';
}

/**
 * On-disk name for one FMS export: the add-on's required name when it has one,
 * otherwise `ORIGDEST` from the OFP plus the extension of the downloaded file.
 * Aircraft FMCs list these files and the pilot types the name on the CDU, whose
 * keyboard has no underscore (the A330's among them), so the name is the same
 * letters-and-digits stem the planner's Save to X-Plane writes.
 */
export function fmsExportFilename(formatKey: string, ofp: SimBriefOFP, link: string): string {
  const required = REQUIRED_NAMES[formatKey];
  if (required) return required;
  return fmsFileStem(ofp.origin.icao_code, ofp.destination.icao_code) + linkExtension(link);
}
