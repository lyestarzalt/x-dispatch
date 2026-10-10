import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type AppAction, describeRemoteUrl } from '@/lib/nativeShell/appUrl';
import { toastError } from '@/lib/utils/toastError';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { airportsListQuery } from '@/queries/useAirportsListQuery';
import { trackEvent } from '@/queries/useAnalytics';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useLaunchStore } from '@/stores/launchStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';

interface ActionContext {
  t: (key: string, options?: Record<string, unknown>) => string;
  airports: () => Airport[];
}

/**
 * Runs the actions behind xdispatch:// links. Once the app is ready it drains
 * what arrived before (a cold-start link), then takes pushes; anything pushed
 * while loading waits for ready.
 */
export function useAppActions(ready: boolean): void {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const readyRef = useRef(ready);
  const ctxRef = useRef<ActionContext>({ t, airports: () => [] });
  const buffered = useRef<AppAction[]>([]);

  // Latest language and query client for actions that arrive later, without resubscribing.
  useEffect(() => {
    readyRef.current = ready;
    ctxRef.current = {
      t,
      airports: () => queryClient.getQueryData(airportsListQuery.queryKey) ?? [],
    };
  });

  useEffect(() => {
    const run = (action: AppAction) => {
      trackEvent('deep_link_opened', { action: action.kind, source: action.source ?? 'none' });
      void runAppAction(action, ctxRef.current);
    };
    return window.appAPI.onAppAction((action) => {
      if (readyRef.current) run(action);
      else buffered.current.push(action);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void window.appAPI.takePendingActions().then((pending) => {
      if (cancelled) return;
      const actions = [...pending, ...buffered.current];
      buffered.current = [];
      for (const action of actions) {
        trackEvent('deep_link_opened', { action: action.kind, source: action.source ?? 'none' });
        void runAppAction(action, ctxRef.current);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
}

function selectAirportOrWarn(icao: string, ctx: ActionContext): boolean {
  const known = ctx.airports().some((a) => a.icao === icao);
  if (!known) {
    toast.warning(ctx.t('appActions.airportNotFound', { icao }));
    return false;
  }
  useAppStore.getState().requestSelectAirport(icao);
  return true;
}

export async function runAppAction(action: AppAction, ctx: ActionContext): Promise<void> {
  const app = useAppStore.getState();
  switch (action.kind) {
    case 'airport': {
      if (!selectAirportOrWarn(action.icao, ctx)) return;
      if (action.runway) {
        app.requestStartRunway(action.icao, action.runway);
        app.requestAirportTab('start');
      } else if (action.tab) {
        app.requestAirportTab(action.tab);
      }
      return;
    }
    case 'route': {
      const builder = usePlanBuilderStore.getState();
      const endpoint = (icao: string | undefined) => {
        if (!icao) return undefined;
        const airport = ctx.airports().find((a) => a.icao === icao);
        if (!airport) {
          toast.warning(ctx.t('appActions.airportNotFound', { icao }));
          return undefined;
        }
        return {
          icao: airport.icao,
          name: airport.name,
          latitude: airport.lat,
          longitude: airport.lon,
        };
      };
      const from = endpoint(action.from);
      const to = endpoint(action.to);
      builder.open();
      if (from) builder.setDeparture(from);
      if (to) builder.setArrival(to);
      if (action.via !== undefined) builder.setRouteText(action.via);
      return;
    }
    case 'simbrief':
      useFlightPlanStore
        .getState()
        .openSimbriefDialog({ pilotId: action.pilotId, autoFetch: true });
      return;
    case 'import-url': {
      const { host, path } = describeRemoteUrl(action.url);
      const accepted = await new Promise<boolean>((resolve) =>
        app.requestConfirmation({ kind: 'import-url', url: action.url, host, path, resolve })
      );
      if (!accepted) return;
      const result = await window.flightPlanAPI.fetchRemote(action.url);
      if (result.error !== null) {
        toastError('flight_plan', ctx.t('appActions.importFailed', { host }));
        return;
      }
      const loaded = await useFlightPlanStore
        .getState()
        .loadFMSFile(result.content, result.fileName);
      trackEvent('flight_plan_file_loaded', { success: loaded });
      if (loaded) toast.success(ctx.t('appActions.importDone', { fileName: result.fileName }));
      else toastError('flight_plan', ctx.t('appActions.importFailed', { host }));
      window.appAPI.requestAttention();
      return;
    }
    case 'import-file': {
      const result = await window.flightPlanAPI.readFile(action.path);
      if (result.error !== null) {
        toastError('flight_plan', ctx.t('appActions.importFileFailed'));
        return;
      }
      const loaded = await useFlightPlanStore
        .getState()
        .loadFMSFile(result.content, result.fileName);
      trackEvent('flight_plan_file_loaded', { success: loaded });
      if (loaded) toast.success(ctx.t('appActions.importDone', { fileName: result.fileName }));
      else toastError('flight_plan', ctx.t('appActions.importFileFailed'));
      return;
    }
    case 'launch': {
      if (action.icao) selectAirportOrWarn(action.icao, ctx);
      useLaunchStore.getState().setPendingAircraftName(action.aircraft ?? null);
      app.setShowLaunchDialog(true);
      return;
    }
    case 'settings':
      app.openSettings(action.tab ?? null);
      return;
    case 'logs':
      await window.appAPI.openLogFolder();
      return;
    case 'update':
      app.openSettings('about');
      await window.appAPI.checkForUpdates();
      return;
    case 'addon':
      app.openAddonManager(action.tab ?? null);
      return;
  }
}
