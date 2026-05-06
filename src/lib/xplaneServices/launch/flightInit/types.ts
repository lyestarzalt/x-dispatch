import type { WeatherConfig } from '@/components/dialogs/LaunchDialog/weatherTypes';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '@/types/position';

export interface BuildFlightInitParams {
  aircraft: Aircraft;
  livery: string;
  startPosition: StartPosition;
  weatherConfig: WeatherConfig;
  useRealWorldTime: boolean;
  dayOfYear: number;
  timeOfDay: number;
  fuelTanksKg: number[];
  payloadKg: number[];
  enginesRunning: boolean;
}

export type WeatherDefinition = NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>>;
