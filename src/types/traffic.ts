/** One aircraft from X-Plane's TCAS target table: AI, multiplayer or plugin-injected. */
export interface TrafficTarget {
  /** TCAS slot 1..63; slot 0 is the user aircraft and never appears here. */
  slot: number;
  modeS: number;
  callsign: string;
  /** ICAO type designator as published by the traffic source, may be empty. */
  icaoType: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  headingDeg: number;
  groundspeedKt: number;
  verticalSpeedFpm: number;
}

export interface TrafficSnapshot {
  targets: TrafficTarget[];
  /** Wall clock of the snapshot in ms, for interpolation on the renderer side. */
  at: number;
}
