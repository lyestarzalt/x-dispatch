import { Map } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiaChartsSection } from '@/modules/sia-france/renderer/settings/SiaChartsSection';
import VacTab from '@/modules/sia-france/renderer/airport/VacTab';
import type { ParsedAirport } from '@/types/apt';
import type { ModuleRuntimeInfo } from './types';

export interface SettingsModuleTabRegistration {
  id: string;
  moduleId: string;
  labelKey: string;
  icon: LucideIcon;
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

/** Settings sidebar entry per enabled module (Réglages → onglet dédié). */
export const settingsModuleTabs: SettingsModuleTabRegistration[] = [
  {
    id: 'sia-france',
    moduleId: 'sia-france',
    labelKey: 'modules.siaFrance.settingsTab',
    icon: Map,
    render: () => <SiaChartsSection />,
  },
];

export const airportModuleTabs: AirportTabRegistration[] = [
  {
    id: 'vac',
    moduleId: 'sia-france',
    labelKey: 'airportInfo.tabs.vac',
    icon: <Map className="h-4 w-4" />,
    isVisible: () => true,
    render: () => <VacTab />,
  },
];

export const toolbarModuleToggles: ToolbarToggleRegistration[] = [
  { id: 'vac-overlay', moduleId: 'sia-france' },
];

export const mapModuleHooks: MapHookRegistration[] = [{ id: 'vac-overlay', moduleId: 'sia-france' }];

export function isModuleActive(modules: ModuleRuntimeInfo[], moduleId: string): boolean {
  return modules.some((m) => m.manifest.id === moduleId && m.state.enabled);
}

export function moduleSettingsTabId(moduleTabId: string): string {
  return `module:${moduleTabId}`;
}

export function isModuleSettingsTabId(tabId: string): boolean {
  return tabId.startsWith('module:');
}
