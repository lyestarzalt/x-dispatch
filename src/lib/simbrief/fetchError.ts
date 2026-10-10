import type { TFunction } from 'i18next';
import type { SimBriefErrorCode } from '@/types/simbrief';

const CODES: ReadonlySet<string> = new Set<SimBriefErrorCode>([
  'invalid_user',
  'unknown_user',
  'no_plan',
  'bad_response',
  'network',
]);

/**
 * The sentence shown under "Failed to fetch flight plan": the translated reason when the
 * error carries a SimBrief code, otherwise the error's own message.
 */
export function describeSimbriefError(error: unknown, t: TFunction): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && CODES.has(code)) return t(`simbrief.errors.${code}`);
  return error instanceof Error ? error.message : String(error);
}
