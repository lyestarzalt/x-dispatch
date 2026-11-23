import type { WeatherConfig } from '@/components/dialogs/LaunchDialog/weatherTypes';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '@/types/position';
import type { Kilograms } from '@/types/units';

export interface BuildFlightInitParams {
  aircraft: Aircraft;
  livery: string;
  startPosition: StartPosition;
  weatherConfig: WeatherConfig;
  useRealWorldTime: boolean;
  dayOfYear: number;
  timeOfDay: number;
  fuelTanksKg: Kilograms[];
  payloadKg: Kilograms[];
  enginesRunning: boolean;
}

export type WeatherDefinition = NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>>;
