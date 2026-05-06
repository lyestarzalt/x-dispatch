import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';

export function buildEngineSection(running: boolean): Pick<FlightInit, 'engine_status'> {
  return {
    engine_status: {
      all_engines: { running },
    },
  };
}
