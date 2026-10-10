/** Flight levels are feet by convention: FL180 and above as a level, below as plain feet. */
export function formatLevel(feet: number | null): string {
  if (feet === null) return '—';
  return feet >= 18000 ? `FL${Math.round(feet / 100)}` : `${feet}`;
}
