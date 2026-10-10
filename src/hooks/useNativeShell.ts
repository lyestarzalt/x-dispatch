import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { toast } from 'sonner';
import type { MenuCommand } from '@/lib/nativeShell/appMenu';
import type { DesktopPrefs } from '@/lib/nativeShell/desktopPrefs';
import type { NativeLabels } from '@/lib/nativeShell/labels';
import { toastError } from '@/lib/utils/toastError';
import { airportsListQuery } from '@/queries/useAirportsListQuery';
import { trackEvent } from '@/queries/useAnalytics';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { ZOOM_LEVEL_RANGE, useSettingsStore } from '@/stores/settingsStore';

function translatedLabels(): NativeLabels {
  const t = i18n.t.bind(i18n);
  return {
    menu: {
      settings: t('nativeShell.menu.settings'),
      edit: t('nativeShell.menu.edit'),
      window: t('nativeShell.menu.window'),
      help: t('nativeShell.menu.help'),
      website: t('nativeShell.menu.website'),
      discord: t('nativeShell.menu.discord'),
      checkForUpdates: t('nativeShell.menu.checkForUpdates'),
      recentAirports: t('nativeShell.menu.recentAirports'),
      file: t('nativeShell.menu.file'),
      openFlightPlan: t('nativeShell.menu.openFlightPlan'),
      importSimbrief: t('nativeShell.menu.importSimbrief'),
      launchXPlane: t('nativeShell.menu.launchXPlane'),
      findAirport: t('nativeShell.menu.findAirport'),
      view: t('nativeShell.menu.view'),
      zoomIn: t('nativeShell.menu.zoomIn'),
      zoomOut: t('nativeShell.menu.zoomOut'),
      zoomReset: t('nativeShell.menu.zoomReset'),
      toggleSidebar: t('nativeShell.menu.toggleSidebar'),
      flightStripWindow: t('nativeShell.menu.flightStripWindow'),
      toggleFullScreen: t('nativeShell.menu.toggleFullScreen'),
      close: t('nativeShell.menu.close'),
      keyboardShortcuts: t('nativeShell.menu.keyboardShortcuts'),
      openLogs: t('nativeShell.menu.openLogs'),
    },
    crash: {
      title: t('nativeShell.crash.title'),
      message: t('nativeShell.crash.message'),
      reload: t('nativeShell.crash.reload'),
      quit: t('nativeShell.crash.quit'),
    },
  };
}

function zoomBy(steps: number) {
  const { appearance, setZoomLevel } = useSettingsStore.getState();
  const { min, max, step } = ZOOM_LEVEL_RANGE;
  const next = steps === 0 ? 1 : appearance.zoomLevel + steps * step;
  setZoomLevel(Math.round(Math.min(max, Math.max(min, next)) * 100) / 100);
}

/** Escape closes a Radix dialog or menu; true when something was open to close. */
function closeTopmostOverlay(): boolean {
  const open = document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]'
  );
  if (!open) return false;
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : open;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return true;
}

async function runMenuCommand(command: MenuCommand): Promise<void> {
  const app = useAppStore.getState();
  switch (command) {
    case 'openFlightPlan': {
      const result = await window.flightPlanAPI.openFile();
      if (!result) return;
      const loaded = await useFlightPlanStore
        .getState()
        .loadFMSFile(result.content, result.fileName);
      trackEvent('flight_plan_file_loaded', { success: loaded });
      if (!loaded) toastError('flight_plan', i18n.t('toolbar.loadPlanFailed'));
      return;
    }
    case 'importSimbrief':
      useFlightPlanStore.getState().openSimbriefDialog({ autoFetch: true });
      return;
    case 'launchXPlane':
      app.setShowLaunchDialog(true);
      return;
    case 'zoomIn':
      zoomBy(1);
      return;
    case 'zoomOut':
      zoomBy(-1);
      return;
    case 'zoomReset':
      zoomBy(0);
      return;
    case 'toggleSidebar':
      app.setShowSidebar(!app.showSidebar);
      return;
    case 'keyboardShortcuts':
      app.setShowShortcuts(true);
      return;
    case 'closeWindow':
      if (!closeTopmostOverlay()) await window.appAPI.closeWindow();
      return;
    case 'flightStripWindow':
    case 'focusSearch':
    case 'openLogs':
      // Main handles these itself.
      return;
  }
}

/**
 * Desktop window only: keeps main's native menu and crash dialog in the UI
 * language, and opens Settings when the menu asks for it.
 */
export function useNativeShell() {
  const queryClient = useQueryClient();

  // Inactive window: the title bar dims, as every native window does.
  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    const apply = (focused: boolean) =>
      document.documentElement.toggleAttribute('data-window-inactive', !focused);
    const setFullScreen = useAppStore.getState().setWindowFullScreen;
    void window.appAPI.getWindowState().then((state) => {
      apply(state.focused);
      setFullScreen(state.fullScreen);
    });
    const offFocus = window.appAPI.onWindowFocus(apply);
    const offFullScreen = window.appAPI.onFullScreen((fullScreen) => {
      setFullScreen(fullScreen);
      if (fullScreen) {
        const keys = window.appAPI.platform === 'darwin' ? '⌃⌘F' : 'F11';
        toast(i18n.t('titleBar.fullScreenHint', { keys }), { duration: 3000 });
      }
    });
    return () => {
      offFocus();
      offFullScreen();
    };
  }, []);

  // Menu items and accelerators: main forwards the command, the stores do the work.
  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    return window.appAPI.onMenuCommand((command) => void runMenuCommand(command));
  }, []);

  // Window behaviour main applies: pushed now and on every change.
  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    const push = (desktop: DesktopPrefs) => window.appAPI.setDesktopPrefs({ ...desktop });
    push(useSettingsStore.getState().desktop);
    return useSettingsStore.subscribe((state, previous) => {
      if (state.desktop !== previous.desktop) push(state.desktop);
    });
  }, []);

  // Recent airports for the dock menu and jump list.
  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    return useAppStore.subscribe(
      (s) => s.selectedICAO,
      (icao) => {
        if (!icao || !useSettingsStore.getState().desktop.recentAirportsMenu) return;
        const airport = queryClient
          .getQueryData(airportsListQuery.queryKey)
          ?.find((a) => a.icao === icao);
        window.appAPI.noteAirportOpened(icao, airport?.name ?? '');
      }
    );
  }, [queryClient]);

  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    const push = () => window.appAPI.setNativeLabels(translatedLabels());
    push();
    i18n.on('languageChanged', push);
    const unsubscribe = window.appAPI.onOpenSettings((tab) =>
      useAppStore.getState().openSettings(tab)
    );
    return () => {
      i18n.off('languageChanged', push);
      unsubscribe();
    };
  }, []);
}
