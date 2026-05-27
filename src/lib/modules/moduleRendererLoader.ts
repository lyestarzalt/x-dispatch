import type { XDispatchModuleManifest } from './types';

/** Phase 2b: exports from an external module renderer bundle (UMD/IIFE global). */
export interface ModuleRendererBundle {
  register?: (api: ModuleRendererHostApi) => void;
}

export interface ModuleRendererHostApi {
  moduleId: string;
}

const loadedBundles = new Map<string, ModuleRendererBundle>();

/**
 * Attempt to load `manifest.renderer` from an installed external module.
 * Bundled modules use `moduleUiRegistry` instead; this path is for ZIP/GitHub installs.
 */
export async function loadExternalModuleRenderer(
  manifest: XDispatchModuleManifest,
  installPath: string | undefined
): Promise<ModuleRendererBundle | null> {
  if (!manifest.renderer || !installPath) return null;

  const cacheKey = `${manifest.id}@${manifest.version}`;
  const cached = loadedBundles.get(cacheKey);
  if (cached) return cached;

  const bundlePath = await window.modulesAPI.getRendererBundlePath(manifest.id);
  if (!bundlePath) return null;

  // Phase 2b: serve bundle via custom protocol + execute in isolated context.
  // Until then, external modules without a core UI mapping stay settings-only.
  void bundlePath;
  return null;
}

export function clearModuleRendererCache(moduleId?: string): void {
  if (!moduleId) {
    loadedBundles.clear();
    return;
  }
  for (const key of loadedBundles.keys()) {
    if (key.startsWith(`${moduleId}@`)) loadedBundles.delete(key);
  }
}
