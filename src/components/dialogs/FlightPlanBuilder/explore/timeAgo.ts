const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "12 minutes ago", "yesterday", in the app's language; under a minute reads as now. */
export function timeAgo(then: number, now: number, language: string): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const elapsed = Math.max(0, now - then);
  for (const [unit, ms] of STEPS) {
    if (elapsed >= ms) return format.format(-Math.floor(elapsed / ms), unit);
  }
  return format.format(0, 'second');
}
