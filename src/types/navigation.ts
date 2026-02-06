export { type Navaid, type Waypoint, type Airspace } from '@/lib/navParser/types';

export interface AirwaySegmentWithCoords {
  name: string;
  fromFix: string;
  toFix: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  isHigh: boolean;
  baseFl: number;
  topFl: number;
}
