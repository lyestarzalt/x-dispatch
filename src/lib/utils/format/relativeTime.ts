/**
 * "5 min ago" in the UI language. Intl rejects made-up locales (pirate), so it falls back to
 * English. Dates further than two weeks away are shown as a plain date instead.
 */
export function formatRelativeTime(date: Date | string, language: string): string {
  const when = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.round((when.getTime() - Date.now()) / 1000);
  const days = Math.round(seconds / 86_400);
  if (Math.abs(days) >= 14) return when.toLocaleDateString(language);
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'narrow' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
  }
  if (Math.abs(seconds) < 60) return rtf.format(0, 'second');
  if (Math.abs(seconds) < 3_600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86_400) return rtf.format(Math.round(seconds / 3_600), 'hour');
  return rtf.format(days, 'day');
}
