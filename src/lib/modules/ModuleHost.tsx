import { useEffect } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { useModulesStore } from '@/stores/modulesStore';

export function ModuleHost() {
  const refresh = useModulesStore((s) => s.refresh);
  const modules = useModulesStore((s) => s.modules);
  const setVacOverlayEnabled = useMapStore((s) => s.setVacOverlayEnabled);
  const setOaciBasemapEnabled = useMapStore((s) => s.setOaciBasemapEnabled);
  const setOaciVectorEnabled = useMapStore((s) => s.setOaciVectorEnabled);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const siaEnabled = modules.some((m) => m.manifest.id === 'sia-france' && m.state.enabled);
    if (siaEnabled) return;
    setVacOverlayEnabled(false);
    setOaciBasemapEnabled(false);
    setOaciVectorEnabled(false);
  }, [modules, setVacOverlayEnabled, setOaciBasemapEnabled, setOaciVectorEnabled]);

  return null;
}
