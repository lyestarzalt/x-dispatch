export type StandOperation = 'airline' | 'cargo' | 'general_aviation' | 'military' | 'none';

export const STAND_OPERATIONS: readonly StandOperation[] = [
  'airline',
  'cargo',
  'general_aviation',
  'military',
  'none',
];

/** Muted ring tints per apt.dat 1301 operation type; unknown stands stay gray. */
export const STAND_TINT: Record<StandOperation, string> = {
  airline: '#3b6ea8',
  cargo: '#a8773b',
  general_aviation: '#3f8f6b',
  military: '#6b7f4a',
  none: '#64748b',
};

/** ICAO aerodrome reference code letter to maximum wingspan in metres. */
export const WIDTH_CODE_WINGSPAN_M: Record<string, number> = {
  A: 15,
  B: 24,
  C: 36,
  D: 52,
  E: 65,
  F: 80,
};

export function normalizeOperation(raw: string | undefined | null): StandOperation {
  const value = (raw ?? '').toLowerCase();
  return (STAND_OPERATIONS as readonly string[]).includes(value)
    ? (value as StandOperation)
    : 'none';
}

export function normalizeWidthCode(raw: string | undefined | null): string | undefined {
  const code = (raw ?? '').trim().toUpperCase();
  return code in WIDTH_CODE_WINGSPAN_M ? code : undefined;
}

/** Wide-body silhouette for the two largest reference codes. */
export function isWideBody(widthCode: string | undefined): boolean {
  return widthCode === 'E' || widthCode === 'F';
}

export interface StandHover {
  x: number;
  y: number;
  name: string;
  locationType: string;
  operation: StandOperation;
  widthCode?: string;
  airlines: string[];
}

/** Common ICAO airline designators; codes outside this table are shown as-is. */
export const AIRLINE_NAMES: Record<string, string> = {
  AAL: 'American Airlines',
  ACA: 'Air Canada',
  AFR: 'Air France',
  AIC: 'Air India',
  ANA: 'All Nippon Airways',
  ANZ: 'Air New Zealand',
  ASA: 'Alaska Airlines',
  AUA: 'Austrian Airlines',
  AVA: 'Avianca',
  AZA: 'ITA Airways',
  BAW: 'British Airways',
  BEL: 'Brussels Airlines',
  CAL: 'China Airlines',
  CCA: 'Air China',
  CES: 'China Eastern',
  CPA: 'Cathay Pacific',
  CSN: 'China Southern',
  DAL: 'Delta Air Lines',
  DLH: 'Lufthansa',
  EIN: 'Aer Lingus',
  ETD: 'Etihad Airways',
  ETH: 'Ethiopian Airlines',
  EVA: 'EVA Air',
  EZY: 'easyJet',
  FDX: 'FedEx Express',
  FIN: 'Finnair',
  GIA: 'Garuda Indonesia',
  IBE: 'Iberia',
  ICE: 'Icelandair',
  JAL: 'Japan Airlines',
  JBU: 'JetBlue',
  JST: 'Jetstar',
  KAL: 'Korean Air',
  KLM: 'KLM',
  LAN: 'LATAM Airlines',
  LOT: 'LOT Polish Airlines',
  MAS: 'Malaysia Airlines',
  MSR: 'EgyptAir',
  NAX: 'Norwegian',
  PAL: 'Philippine Airlines',
  QFA: 'Qantas',
  QTR: 'Qatar Airways',
  RAM: 'Royal Air Maroc',
  RYR: 'Ryanair',
  SAA: 'South African Airways',
  SAS: 'SAS Scandinavian Airlines',
  SIA: 'Singapore Airlines',
  SKW: 'SkyWest Airlines',
  SVA: 'Saudia',
  SWA: 'Southwest Airlines',
  SWR: 'Swiss',
  TAM: 'LATAM Brasil',
  TAP: 'TAP Air Portugal',
  THA: 'Thai Airways',
  THY: 'Turkish Airlines',
  TUI: 'TUI Airways',
  UAE: 'Emirates',
  UAL: 'United Airlines',
  UPS: 'UPS Airlines',
  VIR: 'Virgin Atlantic',
  VLG: 'Vueling',
  VOZ: 'Virgin Australia',
  WJA: 'WestJet',
  WZZ: 'Wizz Air',
};

export function airlineName(code: string): string | undefined {
  return AIRLINE_NAMES[code.toUpperCase()];
}
