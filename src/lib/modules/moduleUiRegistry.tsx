import type { ReactNode } from 'react';
import { Map } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import VacTab from '@/modules/sia-france/renderer/airport/VacTab';
import { SiaChartsSection } from '@/modules/sia-france/renderer/settings/SiaChartsSection';
import type { ParsedAirport } from '@/types/apt';
import type { SettingsModuleTabRegistration } from './registry';
import type { ModuleRuntimeInfo } from './types';

/** Phase 2a: bundled module UI entrypoints (phase 2b = load renderer.bundle.js from install path). */
const MODULE_UI: Record<
  string,
  {
    icon: LucideIcon;
    settings?: () => ReactNode;
    airportTabs?: Array<{
      tabId: string;
      labelKey: string;
      isVisible: (airport: ParsedAirport) => boolean;
      render: () => ReactNode;
    }>;
  }
> = {
  'sia-france': {
    icon: Map,
    settings: () => <SiaChartsSection />,
    airportTabs: [
      {
        tabId: 'vac',
        labelKey: 'airportInfo.tabs.vac',
        isVisible: () => true,
        render: () => <VacTab />,
      },
    ],
  },
};

export function getSettingsModuleTabsForRuntime(
  modules: ModuleRuntimeInfo[]
): SettingsModuleTabRegistration[] {
  const out: SettingsModuleTabRegistration[] = [];
  for (const { manifest, state } of modules) {
    if (!state.enabled) continue;
    const ui = MODULE_UI[manifest.id];
    if (!ui?.settings) continue;

    const declared = manifest.contributions?.settingsTabs;
    if (declared?.length) {
      for (const tab of declared) {
        out.push({
          id: tab.tabId,
          moduleId: manifest.id,
          labelKey: tab.labelKey,
          icon: ui.icon,
          render: ui.settings,
        });
      }
    } else {
      out.push({
        id: manifest.id,
        moduleId: manifest.id,
        labelKey: `modules.${manifest.id}.settingsTab`,
        icon: ui.icon,
        render: ui.settings,
      });
    }
  }
  return out;
}

export function getAirportModuleTabsForRuntime(modules: ModuleRuntimeInfo[]) {
  const out: Array<{
    id: string;
    moduleId: string;
    labelKey: string;
    icon: ReactNode;
    isVisible: (airport: ParsedAirport) => boolean;
    render: () => ReactNode;
  }> = [];

  for (const { manifest, state } of modules) {
    if (!state.enabled) continue;
    const ui = MODULE_UI[manifest.id];
    if (!ui?.airportTabs) continue;
    for (const tab of ui.airportTabs) {
      out.push({
        id: tab.tabId,
        moduleId: manifest.id,
        labelKey: tab.labelKey,
        icon: <Map className="h-4 w-4" />,
        isVisible: tab.isVisible,
        render: tab.render,
      });
    }
  }
  return out;
}
