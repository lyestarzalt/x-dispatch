import type { ThirdPartyNotice } from '@/types/notices';

/** Case-insensitive match on component name or licence; an empty query keeps everything. */
export function filterNotices(entries: ThirdPartyNotice[], query: string): ThirdPartyNotice[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.name.toLowerCase().includes(q) || e.license.toLowerCase().includes(q)
  );
}

/** Distinct licence identifiers with how many components use each, most common first. */
export function licenseSummary(entries: ThirdPartyNotice[]): { license: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.license, (counts.get(e.license) ?? 0) + 1);
  return [...counts.entries()]
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
}
