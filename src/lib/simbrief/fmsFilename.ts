import type { SimBriefOFP } from '@/types/simbrief';

/**
 * Pure builder for the filename an FMS export is written under.
 * Lives in lib so it can be unit-tested without React.
 *
 * The name is derived from the OFP itself, not from SimBrief's per-format
 * `name` (a human label like "X-Plane 11/12") nor from the raw `link` (which
 * can include CDN path segments). The extension comes from the link, since
 * that is authoritative for each format (.fms, .flp, .rte, ...).
 *
 * SimBrief appends a `--TAG` disambiguator to any link that reuses another
 * format's generated file — e.g. the Zibo entry is
 * `xml/CYULKIAD_XML_1787737979.xml--ZBO`. The tag is stripped before the
 * extension is read, otherwise those formats produce an extensionless file.
 */
export function buildFmsFilename(data: SimBriefOFP, link: string): string {
  const sanitize = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');
  const orig = sanitize(data.origin.icao_code);
  const dest = sanitize(data.destination.icao_code);
  const ext = link.replace(/--[A-Za-z0-9]+$/, '').match(/\.[A-Za-z0-9]+$/)?.[0] ?? '';
  return `${orig}_${dest}${ext}`;
}
