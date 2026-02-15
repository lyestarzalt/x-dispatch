/**
 * Shared types for Settings dialog
 */
// Import types from canonical sources
import type { AirportSourceBreakdown } from '@/lib/xplaneData/XPlaneDataManager';
import type { NavDataSources } from '@/lib/xplaneData/cycleInfo';

// Re-export for convenience
export type { NavDataSources, AirportSourceBreakdown };

// Component-specific types (simplified view of data status)
export interface DataTypeStatus {
  count: number;
  source: string | null;
}

// Settings-specific DataLoadStatus (different from XPlaneDataManager's full version)
export interface SettingsDataLoadStatus {
  airports: DataTypeStatus & { breakdown: AirportSourceBreakdown };
  navaids: DataTypeStatus & { byType: Record<string, number> };
  waypoints: DataTypeStatus;
  airspaces: DataTypeStatus;
  airways: DataTypeStatus;
  atc: DataTypeStatus | null;
  holds: DataTypeStatus | null;
  aptMeta: DataTypeStatus | null;
  sources: NavDataSources | null;
}

export interface SettingsSectionProps {
  className?: string;
}
