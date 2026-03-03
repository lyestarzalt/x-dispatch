export interface IvaoPilotLastTrack {
  latitude: number;
  longitude: number;
  altitude: number;
  altitudeDifference: number;
  arrivalDistance: number | null;
  departureDistance: number | null;
  groundSpeed: number;
  heading: number;
  onGround: boolean;
  state: string;
  time: number;
  timestamp: string;
  transponder: number;
  transponderMode: string;
}

export interface IvaoPilotFlightPlan {
  aircraftId: string;
  alternateId: string;
  alternative2Id: string;
  arrivalId: string;
  cruiseLevel: string;
  cruiseSpeed: string;
  departureId: string;
  eet: number;
  endurance: number;
  flightRules: string;
  flightType: string;
  level: string;
  remarks: string;
  revision: number;
  route: string;
  speed: string;
}

export interface IvaoPilot {
  id: number;
  userId: number;
  callsign: string;
  serverId: string;
  softwareTypeId: string;
  softwareVersion: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  lastTrack: IvaoPilotLastTrack;
  flightPlan: IvaoPilotFlightPlan | null;
}

export interface IvaoAtc {
  id: number;
  userId: number;
  callsign: string;
  serverId: string;
  softwareTypeId: string;
  softwareVersion: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  lastTrack: {
    latitude: number;
    longitude: number;
    altitude: number;
    timestamp: string;
    transponder: number;
  };
  atis: {
    lines: string[];
    revision: string;
    timestamp: string;
  } | null;
  atcSession: {
    frequency: number;
    position: string;
  } | null;
}

export interface IvaoData {
  clients: {
    pilots: IvaoPilot[];
    atcs: IvaoAtc[];
  };
  connections: number;
  updatedAt: string;
}
