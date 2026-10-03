import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPanel, DialogTitle } from '@/components/ui/dialog';
import { dialogTimeBucket } from '@/lib/analytics/buckets';
import { launchChoices, launchErrorCode } from '@/lib/analytics/launchChoices';
import { writeFtgRoute } from '@/lib/taxiGraph/ftgExport';
import { isValidAirStartSpeed } from '@/lib/utils/airStartSpeed';
import { toastError } from '@/lib/utils/toastError';
import { uuid } from '@/lib/utils/uuid';
import type { LaunchErrorCode } from '@/lib/xplaneServices/launch';
import {
  buildFlightInit,
  calculateFuelTankWeightsKg,
  calculatePayloadWeightsKg,
  resolveLaunchTime,
} from '@/lib/xplaneServices/launch/flightInit';
import { validateNewFlight } from '@/lib/xplaneServices/launch/flightInit/schema';
import {
  trackEvent,
  useAircraftList,
  useStartFlight,
  useTrackFeatureOpened,
  useWeatherPresets,
  useXPlaneStatus,
} from '@/queries';
import { useAppStore } from '@/stores/appStore';
import { useCompanionAppsStore } from '@/stores/companionAppsStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AircraftList, AircraftPreview, FlightConfig } from './components';
import { showSupportToastIfEligible } from './components/SupportPrompt';
import type { StartPosition } from './types';

interface LaunchPanelProps {
  open: boolean;
  onClose: () => void;
  startPosition: StartPosition | null;
}

/**
 * Map the launcher's error codes into user-actionable messages.
 *
 * The main process classifies the failure rather than passing the raw errno up,
 * because `EACCES` alone cannot distinguish "X-Plane wants administrator rights"
 * from "antivirus is blocking it" — telling those apart needs our own elevation
 * state, which only the main process has. See `classifySpawnError` in
 * `@/lib/xplaneServices/launch`.
 *
 * Falls back to whatever string the main process provided, then to a generic
 * message, so an unrecognised code never renders as nothing.
 */
function launchErrorMessage(
  t: ReturnType<typeof useTranslation>['t'],
  code: LaunchErrorCode | undefined,
  fallback: string | undefined
): string {
  switch (code) {
    case 'ALREADY_RUNNING':
      return t('launcher.spawnErrorAlreadyRunning');
    case 'PATH_NOT_CONFIGURED':
      return t('launcher.spawnErrorPathNotConfigured');
    case 'INVALID_CONFIG':
      return fallback || t('launcher.spawnErrorInvalidConfig');
    case 'EXE_NOT_FOUND':
      return t('launcher.spawnErrorMissing');
    case 'NEEDS_ADMIN':
      return t('launcher.spawnErrorNeedsAdmin');
    case 'ACCESS_BLOCKED':
      return t('launcher.spawnErrorAccessBlocked');
    default:
      return fallback || t('launcher.spawnErrorGeneric');
  }
}

export default function LaunchPanel({ open, onClose, startPosition }: LaunchPanelProps) {
  useTrackFeatureOpened('launch', open);
  const { t } = useTranslation();

  // Check if X-Plane is already running
  const { data: isXPlaneRunning = false } = useXPlaneStatus({ enabled: open });

  // Mutation for starting a flight via REST API
  const startFlightMutation = useStartFlight();

  // TanStack Query for data fetching
  const { data: aircraftList = [], isLoading: isScanning } = useAircraftList(open);
  useWeatherPresets(open);

  // Zustand store state
  const selectedAircraftPath = useLaunchStore((s) => s.selectedAircraftPath);
  const selectedAircraft = useLaunchStore((s) => s.selectedAircraft);
  const selectedLivery = useLaunchStore((s) => s.selectedLivery);
  const tankPercentages = useLaunchStore((s) => s.tankPercentages);
  const payloadWeights = useLaunchStore((s) => s.payloadWeights);
  const timeOfDay = useLaunchStore((s) => s.timeOfDay);
  const useRealWorldTime = useLaunchStore((s) => s.useRealWorldTime);
  const coldAndDark = useLaunchStore((s) => s.coldAndDark);
  const weatherConfig = useLaunchStore((s) => s.weatherConfig);

  // Zustand store actions
  const hydrateAircraft = useLaunchStore((s) => s.hydrateAircraft);
  const setIsLaunching = useLaunchStore((s) => s.setIsLaunching);
  const setLaunchError = useLaunchStore((s) => s.setLaunchError);

  // One visit to the dialog, reported as launch_abandoned when it closes without a flight.
  const visitRef = useRef<{ openedAt: number; launched: boolean; failed: boolean } | null>(null);
  useEffect(() => {
    if (open) {
      visitRef.current = { openedAt: performance.now(), launched: false, failed: false };
      return;
    }
    const visit = visitRef.current;
    visitRef.current = null;
    if (!visit || visit.launched) return;
    trackEvent('launch_abandoned', {
      aircraft_selected: useLaunchStore.getState().selectedAircraft !== null,
      launch_failed: visit.failed,
      time_open: dialogTimeBucket(performance.now() - visit.openedAt),
    });
  }, [open]);

  // Reset transient UI state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsLaunching(false);
      setLaunchError(null);
    }
  }, [open, setIsLaunching, setLaunchError]);

  // Reconcile persisted aircraft path against fresh scanned list
  useEffect(() => {
    if (!selectedAircraftPath || selectedAircraft || aircraftList.length === 0) return;
    const freshAircraft = aircraftList.find((a) => a.path === selectedAircraftPath);
    hydrateAircraft(freshAircraft ?? null);
  }, [selectedAircraftPath, selectedAircraft, aircraftList, hydrateAircraft]);

  // Launch - same FlightInit payload for both: REST API (running) or cold start
  const handleLaunch = async () => {
    if (!selectedAircraft || !startPosition) return;
    if (
      startPosition.type === 'custom' &&
      startPosition.customStartMode === 'air' &&
      !isValidAirStartSpeed(startPosition.airSpeedMs)
    ) {
      setLaunchError(t('toolbar.pinModes.speedRequired'));
      return;
    }
    setIsLaunching(true);
    setLaunchError(null);

    try {
      // Write taxi route for Follow the Greens plugin (fire and forget)
      writeFtgRoute().catch(() => {});

      const tankWeightsKg = calculateFuelTankWeightsKg(selectedAircraft, tankPercentages);
      const payloadWeightsKg = calculatePayloadWeightsKg(payloadWeights);

      const { dayOfYear, timeInHours } = resolveLaunchTime(
        startPosition,
        useRealWorldTime,
        timeOfDay
      );

      // Same FlightInit payload for both paths (REST API and cold start)
      const flightConfig = validateNewFlight(
        buildFlightInit({
          aircraft: selectedAircraft,
          livery: selectedLivery,
          startPosition,
          weatherConfig,
          useRealWorldTime,
          dayOfYear,
          timeOfDay: timeInHours,
          fuelTanksKg: tankWeightsKg,
          payloadKg: payloadWeightsKg,
          enginesRunning: !coldAndDark,
        })
      );

      // Fire autoLaunch companion apps and wait for max configured delay.
      // Sequential: each call returns near-immediately (detached spawn) and
      // preserves the user-configured order for tools that need to start before
      // others (e.g. a hardware driver before XPME).
      const autoLaunchTools = useCompanionAppsStore
        .getState()
        .tools.filter((tool) => tool.autoLaunch);
      let maxDelaySec = 0;
      const failures: { id: string; name: string; error: string }[] = [];

      const errorKeyFor = (code: string | undefined): string => {
        switch (code) {
          case 'NEEDS_ADMIN':
            return 'settings.companionApps.error.needsAdmin';
          case 'FILE_MISSING':
            return 'settings.companionApps.error.fileMissing';
          case 'FILE_NOT_EXECUTABLE':
            return 'settings.companionApps.error.fileNotExecutable';
          case 'BATCH_NOT_SUPPORTED':
            return 'settings.companionApps.error.batchNotSupported';
          default:
            return 'settings.companionApps.error.spawnFailed';
        }
      };

      for (const tool of autoLaunchTools) {
        const result = await window.companionAppsAPI.launch({
          exePath: tool.exePath,
          args: tool.args,
          cwd: tool.cwd,
        });
        if (!result.success) {
          failures.push({
            id: tool.id,
            name: tool.name,
            error: t(errorKeyFor(result.code), {
              defaultValue: result.error ?? t('settings.companionApps.unknownError'),
            }),
          });
        } else {
          maxDelaySec = Math.max(maxDelaySec, tool.delayBeforeXPlaneSec);
        }
      }

      for (const f of failures) {
        toastError(
          'companion_apps',
          t('settings.companionApps.spawnError', { name: f.name, error: f.error })
        );
      }

      const reportLaunch = (
        mode: 'cold_start' | 'change_flight',
        success: boolean,
        code?: LaunchErrorCode | 'CHANGE_FLIGHT_FAILED'
      ) => {
        if (visitRef.current) {
          if (success) visitRef.current.launched = true;
          else visitRef.current.failed = true;
        }
        trackEvent('flight_launched', {
          mode,
          airport: startPosition.airport,
          aircraft_type: selectedAircraft.icao || null,
          helicopter: selectedAircraft.isHelicopter,
          start_type: startPosition.type,
          success,
          error_code: success ? null : launchErrorCode(code),
          companion_apps_launched: autoLaunchTools.length - failures.length,
          ...launchChoices({
            weatherConfig,
            tankPercentages,
            payloadWeights,
            useRealWorldTime,
            coldAndDark,
            livery: selectedLivery,
            aircraftPath: selectedAircraft.path,
            favoriteAircraft: useLaunchStore.getState().favorites.includes(selectedAircraft.path),
            startPosition,
          }),
        });
      };

      if (autoLaunchTools.length > 0) {
        const failedIds = new Set(failures.map((f) => f.id));
        const launchedNames = autoLaunchTools
          .filter((tool) => !failedIds.has(tool.id))
          .map((tool) => tool.name)
          .join(', ');
        if (launchedNames) {
          toast(t('settings.companionApps.statusPill', { names: launchedNames }));
        }
      }

      if (maxDelaySec > 0) {
        await new Promise((resolve) => setTimeout(resolve, maxDelaySec * 1000));
      }

      // Resolve the preview image path: livery image → aircraft preview → aircraft thumbnail
      const selectedLiveryObj = selectedAircraft.liveries.find((l) => l.name === selectedLivery);
      const previewImagePath =
        selectedLiveryObj?.previewImage ??
        selectedAircraft.previewImage ??
        selectedAircraft.thumbnailImage;

      void window.flightsAPI.setAircraftHint({
        icao: selectedAircraft.icao || null,
        name: selectedAircraft.name,
        livery: selectedLivery,
      });

      const logbookEntry = {
        id: uuid(),
        launchedAt: new Date().toISOString(),
        airportICAO: startPosition.airport,
        airportName: useAppStore.getState().selectedAirportData?.name ?? '',
        aircraftName: selectedAircraft.name,
        aircraftICAO: selectedAircraft.icao,
        livery: selectedLivery,
        previewImagePath,
        positionName: startPosition.name,
        positionType: startPosition.type,
        weatherMode: weatherConfig.mode,
        weatherPreset: weatherConfig.preset,
        coldAndDark,
        aircraftPath: selectedAircraft.path,
        startPosition,
        weatherConfig,
        tankPercentages,
        payloadWeights,
        timeOfDay,
        useRealWorldTime,
        flightInit: flightConfig,
      };

      if (isXPlaneRunning) {
        // X-Plane running → send via REST API
        try {
          await startFlightMutation.mutateAsync(flightConfig);
          reportLaunch('change_flight', true);
          useLaunchStore.getState().addLogbookEntry(logbookEntry);
          // NOTE: intentionally NOT clearing `startPosition` here —
          // the user wants to come back to the app and see their gate
          // and taxi route exactly where they left them. Clearing the
          // route lifecycle is handled in appStore (gate change /
          // airport change / explicit Clear button).
          onClose();
          showSupportToastIfEligible();
          if (useSettingsStore.getState().launcher.closeOnLaunch) {
            window.close();
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to change flight';
          window.appAPI.log.error('X-Plane flight change failed', err);
          reportLaunch('change_flight', false, 'CHANGE_FLIGHT_FAILED');
          setLaunchError(errorMessage);
        }
      } else {
        // X-Plane not running → cold launch with the FlightInit payload
        const customLaunchArgs = useSettingsStore.getState().launcher.customLaunchArgs;
        const result = await window.launcherAPI.launch(flightConfig, customLaunchArgs);
        reportLaunch('cold_start', result.success, result.code);
        if (result.success) {
          useLaunchStore.getState().addLogbookEntry(logbookEntry);
          // NOTE: see the matching note in the `isXPlaneRunning` branch —
          // we keep `startPosition` so the user's gate + drawn taxi
          // route stay visible after the launch dialog closes.
          onClose();
          showSupportToastIfEligible();
          if (useSettingsStore.getState().launcher.closeOnLaunch) {
            window.close();
          }
        } else {
          window.appAPI.log.error('X-Plane launch failed', result.error);
          setLaunchError(launchErrorMessage(t, result.code, result.error));
        }
      }
    } catch (err) {
      window.appAPI.log.error('X-Plane launch error', err);
      if (visitRef.current) visitRef.current.failed = true;
      setLaunchError((err as Error).message);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPanel
        className="border-border bg-background fixed inset-x-8 top-[68px] bottom-8 z-50 flex flex-col rounded-lg border"
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{t('launcher.title')}</DialogTitle>
        </VisuallyHidden.Root>
        {/* Header */}
        <div className="border-border bg-card flex h-11 flex-shrink-0 items-center justify-between rounded-t-lg border-b px-4 select-none">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{t('launcher.title')}</span>
            {startPosition && (
              <span className="text-muted-foreground text-sm">
                {startPosition.airport} · {startPosition.name}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            tooltip={t('common.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main content */}
        <div className="flex min-h-0 flex-1">
          <SectionErrorBoundary name="Aircraft List">
            <AircraftList aircraftList={aircraftList} isScanning={isScanning} />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="Aircraft Preview">
            <AircraftPreview />
          </SectionErrorBoundary>

          <SectionErrorBoundary name="Flight Config">
            <FlightConfig
              startPosition={startPosition}
              isXPlaneRunning={isXPlaneRunning}
              onLaunch={handleLaunch}
              aircraftList={aircraftList}
            />
          </SectionErrorBoundary>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
