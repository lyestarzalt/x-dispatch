/**
 * Derives the on-disk filename for an FMS export from the OFP and the download link.
 *
 * The stem comes from the OFP itself, not from SimBrief's per-format `name` (a human
 * label like "X-Plane 11/12") nor from the raw `link` (which can include CDN path
 * segments). The extension comes from the link, which is authoritative for each format
 * (.fms, .flp, .rte, ...).
 */
import type { SimBriefOFP } from '@/types/simbrief';

/**
 * SimBrief appends a `--TAG` disambiguator to any download link that reuses another
 * format's generated file (e.g. `xml/CYULKIAD_XML_123.xml--ZBO`), which puts the tag
 * after the extension. Strip it before reading the extension, or formats such as `zbo`
 * produce a file with no extension at all.
 */
const REUSE_TAG = /--[A-Za-z0-9]+$/;

export function buildFmsFilename(data: SimBriefOFP, link: string): string {
  const sanitize = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');
  const orig = sanitize(data.origin.icao_code);
  const dest = sanitize(data.destination.icao_code);
  const ext = link.replace(REUSE_TAG, '').match(/\.[A-Za-z0-9]+$/)?.[0] ?? '';
  return `${orig}_${dest}${ext}`;
}
