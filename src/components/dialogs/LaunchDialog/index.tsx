import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import tzLookup from 'tz-lookup';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { writeFtgRoute } from '@/lib/taxiGraph/ftgExport';
import { buildFlightInit } from '@/lib/xplaneServices/launch/buildFlightInit';
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

      // Calculate per-tank fuel weights in kilograms for API
      const LBS_TO_KG = 0.453592;
      const tankWeightsKg = new Array(9).fill(0);
      const ratios = selectedAircraft.tankRatios ?? [];
      const indices = selectedAircraft.tankIndices ?? ratios.map((_, i) => i);
      for (let i = 0; i < ratios.length; i++) {
        const ratio = ratios[i];
        if (ratio === undefined) continue;
        const tankCapLbs = ratio * selectedAircraft.maxFuel;
        const slot = indices[i] ?? i;
        tankWeightsKg[slot] = tankCapLbs * ((tankPercentages[i] ?? 0) / 100) * LBS_TO_KG;
      }

      // Calculate per-station payload weights in kilograms for API
      const payloadWeightsKg = new Array(9).fill(0);
      for (let i = 0; i < payloadWeights.length; i++) {
        payloadWeightsKg[i] = (payloadWeights[i] ?? 0) * LBS_TO_KG;
      }

      // Calculate time - for real world time, we need airport's current time (not system time)
      // X-Plane's system_time uses computer timezone, so we calculate it ourselves
      let dayOfYear: number;
      let timeInHours: number;

      if (useRealWorldTime) {
        // Get airport timezone and calculate current time there
        const timezone = tzLookup(startPosition.latitude, startPosition.longitude);
        const now = new Date();

        // Get airport's current time components
        const airportTimeStr = now.toLocaleString('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        });

        // Parse the airport time (format: "M/D/YYYY, HH:MM")
        const [datePart, timePart] = airportTimeStr.split(', ');
        if (!datePart || !timePart) throw new Error('Failed to parse airport time');
        const dateParts = datePart.split('/').map(Number);
        const timeParts = timePart.split(':').map(Number);
        const month = dateParts[0] ?? 1;
        const day = dateParts[1] ?? 1;
        const year = dateParts[2] ?? new Date().getFullYear();
        const hours = timeParts[0] ?? 0;
        const minutes = timeParts[1] ?? 0;

        // Calculate day of year for the airport's date
        const airportDate = new Date(year, month - 1, day);
        const startOfYear = new Date(year, 0, 0);
        dayOfYear = Math.floor(
          (airportDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
        );
        timeInHours = hours + minutes / 60;
      } else {
        // Use today's date with user-selected time
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
        timeInHours = timeOfDay;
      }

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
