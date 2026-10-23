import { parseFMSFile } from '@/lib/parsers/fms';
import logger from '@/lib/utils/loggerRenderer';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { draftFromFms } from './builder/fmsDraft';

/**
 * Opens an X-Plane .fms file in the planner. The file names its SID, STAR and approach and
 * lists the enroute fixes; the planner looks the procedures up, walks the airways and draws
 * the whole plan, as it does for a typed route. False when the file cannot be read.
 */
export function importFmsFile(
  content: string,
  airports: { icao: string; name: string }[]
): boolean {
  const parsed = parseFMSFile(content);
  if (!parsed.success || !parsed.data) {
    logger.flight.warn('FMS file rejected:', parsed.error);
    return false;
  }
  const draft = draftFromFms(parsed.data, (icao) => airports.find((a) => a.icao === icao)?.name);
  if (!draft) {
    logger.flight.warn('FMS file has no departure or arrival airport row');
    return false;
  }
  usePlanBuilderStore.getState().loadFromFms(draft);
  return true;
}
