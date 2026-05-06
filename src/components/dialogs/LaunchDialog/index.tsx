import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { writeFtgRoute } from '@/lib/taxiGraph/ftgExport';
import {
  buildFlightInit,
  calculateFuelTankWeightsKg,
  calculatePayloadWeightsKg,
  resolveLaunchTime,
} from '@/lib/xplaneServices/launch/flightInit';
import { useAircraftList, useStartFlight, useWeatherPresets, useXPlaneStatus } from '@/queries';
import { useAppStore } from '@/stores/appStore';
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

export default function LaunchPanel({ open, onClose, startPosition }: LaunchPanelProps) {
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

  // Launch - same FlightInit payload for both: REST API (running) or --new_flight_json (cold start)
  const handleLaunch = async () => {
    if (!selectedAircraft || !startPosition) return;
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

      // Same FlightInit payload for both paths (REST API and --new_flight_json)
      const flightConfig = buildFlightInit({
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
      });

      // Resolve the preview image path: livery image → aircraft preview → aircraft thumbnail
      const selectedLiveryObj = selectedAircraft.liveries.find((l) => l.name === selectedLivery);
      const previewImagePath =
        selectedLiveryObj?.previewImage ??
        selectedAircraft.previewImage ??
        selectedAircraft.thumbnailImage;

      const logbookEntry = {
        id: crypto.randomUUID(),
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
          useLaunchStore.getState().addLogbookEntry(logbookEntry);
          useAppStore.getState().setStartPosition(null);
          onClose();
          showSupportToastIfEligible();
          if (useSettingsStore.getState().launcher.closeOnLaunch) {
            window.close();
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to change flight';
          window.appAPI.log.error('X-Plane flight change failed', err);
          setLaunchError(errorMessage);
        }
      } else {
        // X-Plane not running → write JSON file and launch with --new_flight_json
        const customLaunchArgs = useSettingsStore.getState().launcher.customLaunchArgs;
        const result = await window.launcherAPI.launch(flightConfig, customLaunchArgs);
        if (result.success) {
          useLaunchStore.getState().addLogbookEntry(logbookEntry);
          useAppStore.getState().setStartPosition(null);
          onClose();
          showSupportToastIfEligible();
          if (useSettingsStore.getState().launcher.closeOnLaunch) {
            window.close();
          }
        } else {
          window.appAPI.log.error('X-Plane launch failed', result.error);
          setLaunchError(result.error || 'Failed to launch');
        }
      }
    } catch (err) {
      window.appAPI.log.error('X-Plane launch error', err);
      setLaunchError((err as Error).message);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-8 z-50 flex flex-col rounded-lg border border-border bg-background"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{t('launcher.title')}</DialogTitle>
          </VisuallyHidden.Root>
          {/* Header */}
          <div className="flex h-11 flex-shrink-0 items-center justify-between rounded-t-lg border-b border-border bg-card px-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{t('launcher.title')}</span>
              {startPosition && (
                <span className="text-sm text-muted-foreground">
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
