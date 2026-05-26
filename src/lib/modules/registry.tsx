import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ParsedAirport } from '@/types/apt';
import {
  getAirportModuleTabsForRuntime,
  getSettingsModuleTabsForRuntime,
} from './moduleUiRegistry';
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

/** @deprecated Use getSettingsModuleTabsForRuntime(modules) — phase 2 manifest-driven tabs. */
export function getSettingsModuleTabs(modules: ModuleRuntimeInfo[]): SettingsModuleTabRegistration[] {
  return getSettingsModuleTabsForRuntime(modules);
}

export function getAirportModuleTabs(modules: ModuleRuntimeInfo[]): AirportTabRegistration[] {
  return getAirportModuleTabsForRuntime(modules);
}

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
