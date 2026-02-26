// src/queries/useAddonManager.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AircraftInfo,
  LiveryInfo,
  LuaScriptInfo,
  PluginInfo,
  SceneryEntry,
  SceneryError,
} from '@/lib/addonManager/core/types';
import { getBrowserErrorMessage, getSceneryErrorMessage } from '@/lib/addonManager/core/types';

// Query keys
export const addonKeys = {
  all: ['addon'] as const,
  scenery: ['addon', 'scenery'] as const,
  sceneryList: ['addon', 'scenery', 'list'] as const,
  sceneryBackups: ['addon', 'scenery', 'backups'] as const,
  aircraft: ['addon', 'aircraft'] as const,
  aircraftIcon: (iconPath: string) => ['addon', 'aircraftIcon', iconPath] as const,
  plugins: ['addon', 'plugins'] as const,
  liveries: (aircraftFolder: string) => ['addon', 'liveries', aircraftFolder] as const,
  luaScripts: ['addon', 'luaScripts'] as const,
};

/**
 * Fetch and classify all scenery entries.
 */
export function useSceneryList(enabled = true) {
  return useQuery({
    queryKey: addonKeys.sceneryList,
    queryFn: async (): Promise<SceneryEntry[]> => {
      const result = await window.addonManagerAPI.scenery.analyze();
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Auto-sort scenery entries by priority.
 */
export function useScenerySort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await window.addonManagerAPI.scenery.sort();
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryList });
    },
  });
}

/**
 * Save custom scenery order.
 */
export function useScenarySaveOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderNames: string[]) => {
      const result = await window.addonManagerAPI.scenery.saveOrder(folderNames);
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryList });
    },
  });
}

/**
 * Toggle scenery entry enabled/disabled.
 */
export function useSceneryToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.scenery.toggle(folderName);
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryList });
    },
  });
}

/**
 * Move scenery entry up or down within its tier.
 */
export function useSceneryMove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderName,
      direction,
    }: {
      folderName: string;
      direction: 'up' | 'down';
    }) => {
      const result = await window.addonManagerAPI.scenery.move(folderName, direction);
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryList });
    },
  });
}

/**
 * Create manual backup.
 */
export function useSceneryBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await window.addonManagerAPI.scenery.backup();
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryBackups });
    },
  });
}

/**
 * List available backups.
 */
export function useSceneryBackups(enabled = true) {
  return useQuery({
    queryKey: addonKeys.sceneryBackups,
    queryFn: () => window.addonManagerAPI.scenery.listBackups(),
    enabled,
  });
}

/**
 * Restore from backup.
 */
export function useSceneryRestore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (backupPath: string) => {
      const result = await window.addonManagerAPI.scenery.restore(backupPath);
      if (!result.ok) {
        throw new Error(getSceneryErrorMessage(result.error as SceneryError));
      }
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryList });
      queryClient.invalidateQueries({ queryKey: addonKeys.sceneryBackups });
    },
  });
}

// ===== AIRCRAFT =====

export function useAircraftList(enabled = true) {
  return useQuery({
    queryKey: addonKeys.aircraft,
    queryFn: async (): Promise<AircraftInfo[]> => {
      const result = await window.addonManagerAPI.browser.scanAircraft();
      if (!result.ok) {
        throw new Error(getBrowserErrorMessage(result.error));
      }
      return result.value;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useAircraftToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.browser.toggleAircraft(folderName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addonKeys.aircraft }),
  });
}

export function useAircraftDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.browser.deleteAircraft(folderName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addonKeys.aircraft }),
  });
}

export function useAircraftLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.browser.lockAircraft(folderName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addonKeys.aircraft }),
  });
}

export function useAircraftIcon(iconPath: string | undefined) {
  return useQuery({
    queryKey: addonKeys.aircraftIcon(iconPath ?? ''),
    queryFn: async (): Promise<string | null> => {
      if (!iconPath) return null;
      return window.addonManagerAPI.browser.getAircraftIcon(iconPath);
    },
    enabled: !!iconPath,
    staleTime: Infinity, // Icons don't change
    gcTime: 1000 * 60 * 30, // Keep in cache 30 minutes
  });
}

// ===== PLUGINS =====

export function usePluginList(enabled = true) {
  return useQuery({
    queryKey: addonKeys.plugins,
    queryFn: async (): Promise<PluginInfo[]> => {
      const result = await window.addonManagerAPI.browser.scanPlugins();
      if (!result.ok) {
        throw new Error(getBrowserErrorMessage(result.error));
      }
      return result.value;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function usePluginToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.browser.togglePlugin(folderName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addonKeys.plugins }),
  });
}

export function usePluginDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.browser.deletePlugin(folderName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addonKeys.plugins }),
  });
}

export function usePluginLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderName: string) => {
      const result = await window.addonManagerAPI.browser.lockPlugin(folderName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addonKeys.plugins }),
  });
}

// ===== LIVERIES =====

export function useLiveryList(aircraftFolder: string, enabled = true) {
  return useQuery({
    queryKey: addonKeys.liveries(aircraftFolder),
    queryFn: async (): Promise<LiveryInfo[]> => {
      const result = await window.addonManagerAPI.browser.scanLiveries(aircraftFolder);
      if (!result.ok) {
        throw new Error(getBrowserErrorMessage(result.error));
      }
      return result.value;
    },
    enabled: enabled && !!aircraftFolder,
    staleTime: 30_000,
  });
}

export function useLiveryDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      aircraftFolder,
      liveryFolder,
    }: {
      aircraftFolder: string;
      liveryFolder: string;
    }) => {
      const result = await window.addonManagerAPI.browser.deleteLivery(
        aircraftFolder,
        liveryFolder
      );
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: (_, { aircraftFolder }) => {
      queryClient.invalidateQueries({ queryKey: addonKeys.liveries(aircraftFolder) });
      queryClient.invalidateQueries({ queryKey: addonKeys.aircraft });
    },
  });
}

// ===== LUA SCRIPTS =====

export function useLuaScriptList(enabled = true) {
  return useQuery({
    queryKey: addonKeys.luaScripts,
    queryFn: async (): Promise<LuaScriptInfo[]> => {
      const result = await window.addonManagerAPI.browser.scanLuaScripts();
      if (!result.ok) {
        throw new Error(getBrowserErrorMessage(result.error));
      }
      return result.value;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useLuaScriptToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fileName: string) => {
      const result = await window.addonManagerAPI.browser.toggleLuaScript(fileName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.luaScripts });
      queryClient.invalidateQueries({ queryKey: addonKeys.plugins });
    },
  });
}

export function useLuaScriptDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fileName: string) => {
      const result = await window.addonManagerAPI.browser.deleteLuaScript(fileName);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.luaScripts });
      queryClient.invalidateQueries({ queryKey: addonKeys.plugins });
    },
  });
}

// ===== UPDATE CHECKS =====

export function useAircraftCheckUpdates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (aircraft: AircraftInfo[]) => {
      const result = await window.addonManagerAPI.browser.checkAircraftUpdates(aircraft);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: (data) => {
      // Use setQueryData to preserve update results instead of refetching
      queryClient.setQueryData(addonKeys.aircraft, data);
    },
  });
}

export function usePluginCheckUpdates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plugins: PluginInfo[]) => {
      const result = await window.addonManagerAPI.browser.checkPluginUpdates(plugins);
      if (!result.ok) throw new Error(getBrowserErrorMessage(result.error));
      return result.value;
    },
    onSuccess: (data) => {
      // Use setQueryData to preserve update results instead of refetching
      queryClient.setQueryData(addonKeys.plugins, data);
    },
  });
}
