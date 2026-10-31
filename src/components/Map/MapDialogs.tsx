/**
 * The modal dialogs that float over the map. They live in their own component
 * so that opening or closing one updates only this subtree: the Map component
 * subscribes to dozens of store slices and renders every panel beneath it, so
 * a dialog flag read there used to re-render the whole map tree each toggle.
 */
import LaunchDialog from '@/components/dialogs/LaunchDialog';
import LogbookDialog from '@/components/dialogs/LogbookDialog';
import SettingsDialog from '@/components/dialogs/SettingsDialog';
import { useAppStore } from '@/stores/appStore';

export function MapDialogs() {
  const showSettings = useAppStore((s) => s.showSettings);
  const showLaunchDialog = useAppStore((s) => s.showLaunchDialog);
  const startPosition = useAppStore((s) => s.startPosition);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setShowLaunchDialog = useAppStore((s) => s.setShowLaunchDialog);

  return (
    <>
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <LaunchDialog
        open={showLaunchDialog}
        onClose={() => setShowLaunchDialog(false)}
        startPosition={startPosition}
      />
      <LogbookDialog />
    </>
  );
}
