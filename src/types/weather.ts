import { DecodedMETAR } from '@/utils/decodeMetar';

export interface WeatherData {
  metar: {
    raw: string;
    decoded: DecodedMETAR;
  } | null;
  taf: string | null;
  loading: boolean;
  error: string | null;
}
