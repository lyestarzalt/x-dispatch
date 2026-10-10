import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import type { DesktopPrefs } from '@/lib/nativeShell/desktopPrefs';
import type { NativeLabels } from '@/lib/nativeShell/labels';
import { airportsListQuery } from '@/queries/useAirportsListQuery';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';

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
    },
    crash: {
      title: t('nativeShell.crash.title'),
      message: t('nativeShell.crash.message'),
      reload: t('nativeShell.crash.reload'),
      quit: t('nativeShell.crash.quit'),
    },
  };
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
    void window.appAPI.getWindowState().then((state) => apply(state.focused));
    return window.appAPI.onWindowFocus(apply);
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
