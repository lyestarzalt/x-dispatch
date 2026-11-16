import type { ReactNode } from 'react';
import { type ExternalToast, toast } from 'sonner';
import {
  ANALYTICS_ERROR_CODES,
  type AnalyticsErrorAction,
  type AnalyticsErrorArea,
  type AnalyticsErrorCode,
} from '@/lib/analytics/events';
import logger from '@/lib/utils/loggerRenderer';
import { trackEvent } from '@/queries/useAnalytics';

export interface ShownError {
  /** What the app was doing. Required: an error with no action cannot be shown. */
  action: AnalyticsErrorAction;
  /**
   * Why it failed, in whatever form the call site has it: a code, an error that
   * carries a `code` (or an `error.code`), or the thrown value itself.
   */
  cause?: unknown;
}

function codeOf(cause: unknown): string | null {
  if (typeof cause === 'string') return cause;
  if (cause && typeof cause === 'object') {
    const { code, error } = cause as { code?: unknown; error?: { code?: unknown } | null };
    if (typeof code === 'string') return code;
    if (error && typeof error === 'object' && typeof error.code === 'string') return error.code;
  }
  return null;
}

/**
 * The cause as usage stats may carry it: one of a fixed list, never free text.
 * Null when no cause was given; `other` when one was given that is not listed.
 */
export function errorCode(cause: unknown): AnalyticsErrorCode | null {
  if (cause === undefined || cause === null) return null;
  const code = codeOf(cause)?.toLowerCase();
  return (ANALYTICS_ERROR_CODES as readonly string[]).includes(code ?? '')
    ? (code as AnalyticsErrorCode)
    : 'other';
}

/**
 * Shows an error toast and records where it came from, what was being done and
 * why it failed. Usage stats get fixed values only, never the message. The
 * message goes to the app log; a thrown error with no known code goes to the
 * error log too, which files it for us.
 */
export function toastError(
  area: AnalyticsErrorArea,
  what: ShownError,
  message: ReactNode,
  options?: ExternalToast
) {
  const code = errorCode(what.cause);
  trackEvent('error_shown', { area, action: what.action, code });

  const text = typeof message === 'string' ? `: ${message}` : '';
  const line = `Error shown (${area}/${what.action}, ${code ?? 'no cause'})${text}`;
  if (code === 'other' && what.cause instanceof Error) logger.renderer.error(line, what.cause);
  else logger.renderer.warn(line);

  return toast.error(message, options);
}
