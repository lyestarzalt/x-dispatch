/** `bundled` = shipped with the app but optional at runtime (not part of core boot). */
export type ModuleKind = 'core' | 'bundled' | 'external';

export interface ModuleCondition {
  icaoPrefix?: string;
  countryIncludes?: string;
}

/** @deprecated Use settings tab registration in registry instead. */
export interface ModuleSettingsContribution {
  sectionId: string;
  tabId?: string;
}

export interface ModuleSettingsTabContribution {
  tabId: string;
  labelKey: string;
}

export interface ModuleAirportTabContribution {
  tabId: string;
  when?: ModuleCondition;
}

export interface ModuleToolbarToggleContribution {
  toggleId: string;
}

export interface ModuleMapHookContribution {
  hookId: string;
}

export interface ModuleProtocolContribution {
  scheme: string;
}

export interface ModuleContributions {
  /** @deprecated Prefer settingsTabs (phase 2). */
  settingsSections?: ModuleSettingsContribution[];
  /** Dedicated Settings sidebar tab(s) for this module. */
  settingsTabs?: ModuleSettingsTabContribution[];
  airportTabs?: ModuleAirportTabContribution[];
  toolbarToggles?: ModuleToolbarToggleContribution[];
  mapHooks?: ModuleMapHookContribution[];
  protocols?: ModuleProtocolContribution[];
}

export interface XDispatchModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  minAppVersion?: string;
  kind: ModuleKind;
  /** Default enable state when the module is first registered (bundled modules only). */
  defaultEnabled?: boolean;
  /** Relative path inside the module package for phase-2 UI bundle (e.g. renderer.bundle.js). */
  renderer?: string;
  main?: string;
  contributions?: ModuleContributions;
}

export interface InstalledModuleState {
  id: string;
  enabled: boolean;
  source: 'bundled' | 'zip' | 'github';
  installPath?: string;
  repository?: string;
  installedAt: string;
  trusted: boolean;
}

export interface ModuleRuntimeInfo {
  manifest: XDispatchModuleManifest;
  state: InstalledModuleState;
}

export interface ModuleCatalogEntry {
  id: string;
  repository: string;
  defaultRef?: string;
  trusted: boolean;
  bundled?: boolean;
  name?: string;
  description?: string;
  author?: string;
}

export interface ModuleCatalogFile {
  modules: ModuleCatalogEntry[];
}
