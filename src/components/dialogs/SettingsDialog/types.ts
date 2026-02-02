/**
 * Shared types for Settings dialog
 */

type DataSourceType = 'navigraph' | 'xplane-default' | 'unknown';

interface DataSourceInfo {
  source: DataSourceType;
  cycle: string | null;
  revision: string | null;
  effectiveDate: Date | string | null;
  expirationDate: Date | string | null;
  isExpired: boolean;
  isCustomData: boolean;
}

export interface DataTypeStatus {
  count: number;
  source: string | null;
}

export interface AirportSourceBreakdown {
  globalAirports: number;
  customScenery: number;
  customSceneryPacks: number;
}

export interface NavDataSources {
  global: DataSourceInfo;
  navaids: DataSourceInfo;
  waypoints: DataSourceInfo;
  airways: DataSourceInfo;
  procedures: DataSourceInfo;
  airspaces: DataSourceInfo;
  atc: DataSourceInfo | null;
  holds: DataSourceInfo | null;
  aptMeta: DataSourceInfo | null;
  mora: DataSourceInfo | null;
  msa: DataSourceInfo | null;
}

export interface DataLoadStatus {
  airports: DataTypeStatus & { breakdown: AirportSourceBreakdown };
  navaids: DataTypeStatus & { byType: Record<string, number> };
  waypoints: DataTypeStatus;
  airspaces: DataTypeStatus;
  airways: DataTypeStatus;
  atc: DataTypeStatus | null;
  holds: DataTypeStatus | null;
  aptMeta: DataTypeStatus | null;
  mora: DataTypeStatus | null;
  msa: DataTypeStatus | null;
  sources: NavDataSources | null;
}

export interface SettingsSectionProps {
  className?: string;
}
