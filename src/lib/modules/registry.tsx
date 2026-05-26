import { Map } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiaChartsSection } from '@/modules/sia-france/renderer/settings/SiaChartsSection';
import VacTab from '@/modules/sia-france/renderer/airport/VacTab';
import type { ParsedAirport } from '@/types/apt';
import type { ModuleRuntimeInfo } from './types';

export interface SettingsModuleSectionRegistration {
  id: string;
  moduleId: string;
  tabId: string;
  render: () => ReactNode;
}

export interface AirportTabRegistration {
  id: string;
  moduleId: string;
  labelKey: string;
  icon: ReactNode;
  isVisible: (airport: ParsedAirport) => boolean;
  render: () => ReactNode;
}

export interface ToolbarToggleRegistration {
  id: string;
  moduleId: string;
}

export interface MapHookRegistration {
  id: string;
  moduleId: string;
}

export const settingsModuleSections: SettingsModuleSectionRegistration[] = [
  {
    id: 'sia-charts',
    moduleId: 'sia-france',
    tabId: 'graphics',
    render: () => <SiaChartsSection />,
  },
];

export const airportModuleTabs: AirportTabRegistration[] = [
  {
    id: 'vac',
    moduleId: 'sia-france',
    labelKey: 'airportInfo.tabs.vac',
    icon: <Map className="h-4 w-4" />,
    isVisible: (airport) =>
      airport.id.startsWith('LF') || (airport.metadata.country ?? '').includes('FRA'),
    render: () => <VacTab />,
  },
];

export const toolbarModuleToggles: ToolbarToggleRegistration[] = [
  { id: 'vac-overlay', moduleId: 'sia-france' },
  { id: 'oaci-basemap', moduleId: 'sia-france' },
  { id: 'oaci-vector', moduleId: 'sia-france' },
];

export const mapModuleHooks: MapHookRegistration[] = [
  { id: 'vac-overlay', moduleId: 'sia-france' },
  { id: 'oaci-basemap', moduleId: 'sia-france' },
  { id: 'oaci-vector', moduleId: 'sia-france' },
];

export function isModuleActive(modules: ModuleRuntimeInfo[], moduleId: string): boolean {
  return modules.some((m) => m.manifest.id === moduleId && m.state.enabled);
}
