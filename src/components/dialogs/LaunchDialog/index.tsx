import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import tzLookup from 'tz-lookup';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import {
  type FlightInit,
  useAircraftList,
  useStartFlight,
  useWeatherPresets,
  useXPlaneStatus,
} from '@/queries';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AircraftList, AircraftPreview, FlightConfig } from './components';
import type { StartPosition } from './types';
import type { WeatherConfig } from './weatherTypes';

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
  const { data: weatherPresets = [] } = useWeatherPresets(open);

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
      // Calculate per-tank fuel weights in kilograms for API
      const LBS_TO_KG = 0.453592;
      const tankWeightsKg = new Array(9).fill(0);
      const ratios = selectedAircraft.tankRatios ?? [];
      const indices = selectedAircraft.tankIndices ?? ratios.map((_, i) => i);
      for (let i = 0; i < ratios.length; i++) {
        const tankCapLbs = ratios[i] * selectedAircraft.maxFuel;
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
        const [month, day, year] = datePart.split('/').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);

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
      const flightConfig = buildFlightAPIPayload({
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
        const result = await window.launcherAPI.launch(flightConfig);
        if (result.success) {
          useLaunchStore.getState().addLogbookEntry(logbookEntry);
          useAppStore.getState().setStartPosition(null);
          onClose();
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

  // Build Flight Initialization API payload for REST API
  function buildFlightAPIPayload(params: {
    aircraft: NonNullable<typeof selectedAircraft>;
    livery: string;
    startPosition: StartPosition;
    weatherConfig: WeatherConfig;
    useRealWorldTime: boolean;
    dayOfYear: number;
    timeOfDay: number;
    fuelTanksKg: number[];
    payloadKg: number[];
    enginesRunning: boolean;
  }): FlightInit {
    const payload: FlightInit = {
      // Aircraft
      aircraft: {
        path: params.aircraft.path,
        ...(params.livery !== 'Default' && { livery: params.livery }),
      },
      // Weight (fuel + payload)
      weight: {
        fueltank_weight_in_kilograms: params.fuelTanksKg,
        payload_weight_in_kilograms: params.payloadKg,
      },
      // Engine status
      engine_status: {
        all_engines: { running: params.enginesRunning },
      },
    };

    // Start location
    // TODO: ramp_start doesn't handle duplicate gate names (e.g. multiple "B3" at same airport).
    // Previously used lle_ground_start with exact lat/lon/heading (commit f0a6863) but X-Plane
    // started placing the aircraft offset forward by several meters. Switched to ramp_start as workaround.
    // TODO: switching to another airport mid-flight does not render the ground.
    if (params.startPosition.type === 'custom') {
      payload.lle_ground_start = {
        latitude: params.startPosition.latitude,
        longitude: params.startPosition.longitude,
        heading_true: params.startPosition.heading,
      };
    } else if (params.startPosition.type === 'ramp') {
      payload.ramp_start = {
        airport_id: params.startPosition.airport,
        ramp: params.startPosition.name,
      };
    } else {
      payload.runway_start = {
        airport_id: params.startPosition.airport,
        runway: params.startPosition.name,
        // Approach distance and tow type are mutually exclusive
        ...(params.startPosition.approachDistanceNm != null && {
          // X-Plane requires float values with decimal point — ensure whole numbers get .0
          final_distance_in_nautical_miles: Number.isInteger(
            params.startPosition.approachDistanceNm
          )
            ? params.startPosition.approachDistanceNm + 0.001
            : params.startPosition.approachDistanceNm,
        }),
        ...(params.startPosition.towType && {
          tow_type: params.startPosition.towType,
          ...(params.startPosition.towType === 'tug' && {
            tow_aircraft: { path: 'Aircraft/Laminar Research/Cessna 172 SP/Cessna_172SP.acf' },
          }),
        }),
      };
    }

    // Time
    if (params.useRealWorldTime) {
      payload.use_system_time = true;
    } else {
      payload.local_time = {
        day_of_year: params.dayOfYear,
        time_in_24_hours: params.timeOfDay,
      };
    }

    // Weather
    payload.weather = buildWeatherPayload(params.weatherConfig, params.startPosition);

    return payload;
  }

  // Hardcoded preset weather definitions — identical to the working values from commit 03b81ff.
  // These use X-Plane preset definition strings which are guaranteed to work with --new_flight_json.
  function getPresetWeatherDefinition(
    preset: string
  ): NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>> {
    type WeatherDefinition = NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>>;
    const definitions: Record<string, WeatherDefinition> = {
      clear: {
        definition: 'vfr_few_clouds',
        vertical_speed_in_thermal_in_feet_per_minute: 0,
        wave_height_in_meters: 1,
        wave_direction_in_degrees: 270,
        terrain_state: 'dry',
        variation_across_region_percentage: 0,
        evolution_over_time_enum: 'static',
      },
      cloudy: {
        definition: 'vfr_broken',
        vertical_speed_in_thermal_in_feet_per_minute: 0,
        wave_height_in_meters: 2,
        wave_direction_in_degrees: 270,
        terrain_state: 'dry',
        variation_across_region_percentage: 50,
        evolution_over_time_enum: 'static',
      },
      rainy: {
        definition: 'ifr_non_precision',
        vertical_speed_in_thermal_in_feet_per_minute: 0,
        wave_height_in_meters: 4,
        wave_direction_in_degrees: 200,
        terrain_state: 'medium_wet',
        variation_across_region_percentage: 50,
        evolution_over_time_enum: 'gradually_deteriorating',
      },
      stormy: {
        definition: 'large_cell_thunderstorm',
        vertical_speed_in_thermal_in_feet_per_minute: 500,
        wave_height_in_meters: 8,
        wave_direction_in_degrees: 180,
        terrain_state: 'very_wet',
        variation_across_region_percentage: 100,
        evolution_over_time_enum: 'rapidly_deteriorating',
      },
      snowy: {
        definition: 'ifr_precision',
        vertical_speed_in_thermal_in_feet_per_minute: 0,
        wave_height_in_meters: 2,
        wave_direction_in_degrees: 320,
        terrain_state: 'medium_snowy',
        variation_across_region_percentage: 30,
        evolution_over_time_enum: 'static',
      },
      foggy: {
        definition: 'ifr_precision',
        vertical_speed_in_thermal_in_feet_per_minute: 0,
        wave_height_in_meters: 1,
        wave_direction_in_degrees: 270,
        terrain_state: 'lightly_wet',
        variation_across_region_percentage: 0,
        evolution_over_time_enum: 'static',
      },
    };
    return definitions[preset] || definitions.clear;
  }

  function buildWeatherPayload(config: WeatherConfig, pos: StartPosition): FlightInit['weather'] {
    // Real weather — let X-Plane fetch live data
    if (config.mode === 'real') return 'use_real_weather';

    // Preset mode — use exact hardcoded definitions (proven working with --new_flight_json)
    if (config.mode === 'preset') {
      return getPresetWeatherDefinition(config.preset);
    }

    // Custom mode — build full definition object
    type WeatherDefinition = NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>>;
    const c = config.custom;

    // Build cloud layers (max 3) — X-Plane spells cumulonimbus as 'cumulunimbus'
    const clouds = c.clouds.map((layer) => ({
      type: (layer.type === 'cumulonimbus' ? 'cumulunimbus' : layer.type) as
        | 'cirrus'
        | 'stratus'
        | 'cumulus'
        | 'cumulunimbus',
      cover_ratio: layer.cover,
      bases_in_feet_msl: layer.base_ft,
      tops_in_feet_msl: layer.tops_ft,
    }));

    // Build wind layers — map directly from wind array
    const wind = c.wind.map((w) => ({
      altitude_in_feet_msl: w.altitude_ft,
      speed_in_knots: w.speed_kts,
      direction_in_degrees_true: w.direction_deg,
      ...(w.gust_kts > 0 && { gust_increase_in_knots: w.gust_kts }),
      ...(w.shear_deg > 0 && { shear_in_degrees: w.shear_deg }),
      ...(w.turbulence > 0 && { turbulence_ratio: w.turbulence }),
    }));

    return {
      definition: {
        latitude_in_degrees: pos.latitude,
        longitude_in_degrees: pos.longitude,
        elevation_in_meters: (pos.elevationFt ?? 0) * 0.3048,
        visibility_in_kilometers: c.visibility_km,
        precipitation_ratio: c.precipitation,
        temperature_in_degrees_celsius: c.temperature_c,
        altimeter_setting_in_hpa: c.altimeter_hpa,
        ...(clouds.length > 0 && { clouds }),
        ...(wind.length > 0 && { wind }),
      },
      vertical_speed_in_thermal_in_feet_per_minute: c.thermal_fpm,
      wave_height_in_meters: c.wave_height_m,
      wave_direction_in_degrees: c.wave_direction_deg,
      terrain_state: c.terrain_state,
      variation_across_region_percentage: c.variation_pct,
      evolution_over_time_enum: c.evolution,
    } satisfies WeatherDefinition;
  }

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
