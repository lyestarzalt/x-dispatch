import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import tzLookup from 'tz-lookup';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { type FlightInit, useStartFlight, useXPlaneStatus } from '@/queries';
import { AircraftList, AircraftPreview, FlightConfig } from './components';
import {
  Aircraft,
  AircraftType,
  EngineType,
  StartPosition,
  WeatherPreset,
  getFavorites,
  saveFavorites,
} from './types';

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

  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterManufacturer, setFilterManufacturer] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAircraftType, setFilterAircraftType] = useState<AircraftType>('all');
  const [filterEngineType, setFilterEngineType] = useState<EngineType>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(getFavorites());

  const [selectedLivery, setSelectedLivery] = useState<string>('Default');
  const [liveryImages, setLiveryImages] = useState<Record<string, string>>({});

  const [fuelPercentage, setFuelPercentage] = useState(50);
  const [weatherPresets, setWeatherPresets] = useState<WeatherPreset[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<string>('clear');
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [useRealWorldTime, setUseRealWorldTime] = useState(false);
  const [coldAndDark, setColdAndDark] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [aircraftImages, setAircraftImages] = useState<Record<string, string>>({});
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      setIsScanning(true);
      try {
        const cached = await window.launcherAPI.getAircraft();
        if (cached.length > 0) {
          setAircraft(cached);
        } else {
          const result = await window.launcherAPI.scanAircraft();
          if (result.success) setAircraft(result.aircraft);
        }
        const presets = await window.launcherAPI.getWeatherPresets();
        setWeatherPresets(presets);
      } catch (err) {
        window.appAPI.log.error('Failed to load launch panel data', err);
      } finally {
        setIsScanning(false);
      }
    };
    loadData();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setFilterManufacturer('all');
      setFilterCategory('all');
      setFilterAircraftType('all');
      setFilterEngineType('all');
      setShowFavoritesOnly(false);
    }
  }, [open]);

  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      saveFavorites(next);
      return next;
    });
  }, []);

  const loadAircraftImage = useCallback(
    async (ac: Aircraft) => {
      if (!ac.previewImage || aircraftImages[ac.path]) return;
      const data = await window.launcherAPI.getAircraftImage(ac.previewImage);
      if (data) setAircraftImages((prev) => ({ ...prev, [ac.path]: data }));
    },
    [aircraftImages]
  );

  const loadLiveryImage = useCallback(
    async (path: string | null, key: string) => {
      if (!path || liveryImages[key]) return;
      const data = await window.launcherAPI.getAircraftImage(path);
      if (data) setLiveryImages((prev) => ({ ...prev, [key]: data }));
    },
    [liveryImages]
  );

  useEffect(() => {
    aircraft.slice(0, 20).forEach(loadAircraftImage);
  }, [aircraft, loadAircraftImage]);

  useEffect(() => {
    if (selectedAircraft) {
      selectedAircraft.liveries.forEach((liv) => {
        if (liv.previewImage) {
          loadLiveryImage(liv.previewImage, `${selectedAircraft.path}:${liv.name}`);
        }
      });
    }
  }, [selectedAircraft, loadLiveryImage]);

  const handleSelectAircraft = (ac: Aircraft) => {
    setSelectedAircraft(ac);
    setSelectedLivery('Default');
    loadAircraftImage(ac);
  };

  // Launch - uses REST API if X-Plane is running, otherwise Freeflight.prf
  const handleLaunch = async () => {
    if (!selectedAircraft || !startPosition) return;
    setIsLoading(true);
    setLaunchError(null);

    try {
      // Determine weather definition - normalize preset names for matching
      const weatherPreset = weatherPresets.find((w) => {
        const normalizedName = w.name.toLowerCase().replace(/\s+/g, '');
        return normalizedName === selectedWeather || normalizedName.startsWith(selectedWeather);
      });
      const weatherDefinition = weatherPreset?.definition || '';
      const weatherName = weatherPreset?.name || selectedWeather;

      // Calculate fuel tank weights (auto distribution) - in kilograms for API
      const tankCount = selectedAircraft.tankNames.length || 2;
      const totalFuelLbs = selectedAircraft.maxFuel * (fuelPercentage / 100);
      const totalFuelKg = totalFuelLbs * 0.453592; // Convert lbs to kg
      const tankWeightsKg = new Array(9).fill(0);
      if (tankCount >= 2) {
        tankWeightsKg[0] = totalFuelKg / 2;
        tankWeightsKg[2] = totalFuelKg / 2;
      } else {
        tankWeightsKg[0] = totalFuelKg;
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

      if (isXPlaneRunning) {
        // Use REST API to change flight in running X-Plane
        const flightConfig = buildFlightAPIPayload({
          aircraft: selectedAircraft,
          livery: selectedLivery,
          startPosition,
          weather: selectedWeather,
          useRealWorldTime,
          dayOfYear,
          timeOfDay: timeInHours,
          fuelTanksKg: tankWeightsKg,
          enginesRunning: !coldAndDark,
        });

        try {
          await startFlightMutation.mutateAsync(flightConfig);
          onClose();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to change flight';
          window.appAPI.log.error('X-Plane flight change failed', err);
          setLaunchError(errorMessage);
        }
      } else {
        // Use Freeflight.prf to start X-Plane
        const tankWeightsLbs = new Array(9).fill(0);
        if (tankCount >= 2) {
          tankWeightsLbs[0] = totalFuelLbs / 2;
          tankWeightsLbs[2] = totalFuelLbs / 2;
        } else {
          tankWeightsLbs[0] = totalFuelLbs;
        }

        const config = {
          aircraft: selectedAircraft,
          livery: selectedLivery,
          fuel: { percentage: fuelPercentage, tankWeights: tankWeightsLbs },
          startPosition: {
            type: startPosition.type,
            airport: startPosition.airport,
            position: startPosition.name,
            index: startPosition.index,
            xplaneIndex: startPosition.xplaneIndex,
          },
          time: {
            dayOfYear,
            timeInHours,
            latitude: startPosition.latitude,
            longitude: startPosition.longitude,
          },
          weather: {
            name: weatherName,
            definition: weatherDefinition,
          },
          startEngineRunning: !coldAndDark,
        };

        const result = await window.launcherAPI.launch(config);
        if (result.success) {
          onClose();
        } else {
          window.appAPI.log.error('X-Plane launch failed', result.error);
          setLaunchError(result.error || 'Failed to launch');
        }
      }
    } catch (err) {
      window.appAPI.log.error('X-Plane launch error', err);
      setLaunchError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Build Flight Initialization API payload for REST API
  function buildFlightAPIPayload(params: {
    aircraft: Aircraft;
    livery: string;
    startPosition: StartPosition;
    weather: string;
    useRealWorldTime: boolean;
    dayOfYear: number;
    timeOfDay: number;
    fuelTanksKg: number[];
    enginesRunning: boolean;
  }): FlightInit {
    const payload: FlightInit = {
      // Aircraft
      aircraft: {
        path: params.aircraft.path,
        ...(params.livery !== 'Default' && { livery: params.livery }),
      },
      // Weight (fuel)
      weight: {
        fueltank_weight_in_kilograms: params.fuelTanksKg,
      },
      // Engine status
      engine_status: {
        all_engines: { running: params.enginesRunning },
      },
    };

    // Start location
    if (params.startPosition.type === 'ramp') {
      payload.ramp_start = {
        airport_id: params.startPosition.airport,
        ramp: params.startPosition.name,
      };
    } else {
      payload.runway_start = {
        airport_id: params.startPosition.airport,
        runway: params.startPosition.name,
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
    if (params.weather === 'real') {
      payload.weather = 'use_real_weather';
    } else {
      type WeatherDefinition = NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>>;
      const weatherDefinitions: Record<string, WeatherDefinition> = {
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
      payload.weather = weatherDefinitions[params.weather] || weatherDefinitions.clear;
    }

    return payload;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 flex h-[90vh] w-[95vw] min-w-[900px] max-w-7xl translate-x-[-50%] translate-y-[-50%] flex-col rounded-lg border border-border bg-background"
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
                <span className="text-xs text-muted-foreground">
                  {startPosition.airport} · {startPosition.name}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              title={t('common.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Main content */}
          <div className="flex min-h-0 flex-1">
            <SectionErrorBoundary name="Aircraft List">
              <AircraftList
                aircraft={aircraft}
                selectedAircraft={selectedAircraft}
                isScanning={isScanning}
                searchQuery={searchQuery}
                filterCategory={filterCategory}
                filterManufacturer={filterManufacturer}
                filterAircraftType={filterAircraftType}
                filterEngineType={filterEngineType}
                showFavoritesOnly={showFavoritesOnly}
                favorites={favorites}
                aircraftImages={aircraftImages}
                onSearchChange={setSearchQuery}
                onCategoryChange={setFilterCategory}
                onManufacturerChange={setFilterManufacturer}
                onAircraftTypeChange={setFilterAircraftType}
                onEngineTypeChange={setFilterEngineType}
                onToggleFavoritesOnly={() => setShowFavoritesOnly(!showFavoritesOnly)}
                onSelectAircraft={handleSelectAircraft}
                onToggleFavorite={toggleFavorite}
              />
            </SectionErrorBoundary>

            <SectionErrorBoundary name="Aircraft Preview">
              <AircraftPreview
                aircraft={selectedAircraft}
                selectedLivery={selectedLivery}
                aircraftImages={aircraftImages}
                liveryImages={liveryImages}
                onSelectLivery={setSelectedLivery}
              />
            </SectionErrorBoundary>

            <SectionErrorBoundary name="Flight Config">
              <FlightConfig
                aircraft={selectedAircraft}
                startPosition={startPosition}
                selectedLivery={selectedLivery}
                timeOfDay={timeOfDay}
                selectedWeather={selectedWeather}
                fuelPercentage={fuelPercentage}
                useRealWorldTime={useRealWorldTime}
                coldAndDark={coldAndDark}
                isLoading={isLoading}
                launchError={launchError}
                isXPlaneRunning={isXPlaneRunning}
                onTimeChange={setTimeOfDay}
                onWeatherChange={setSelectedWeather}
                onFuelChange={setFuelPercentage}
                onRealWorldTimeChange={setUseRealWorldTime}
                onColdAndDarkChange={setColdAndDark}
                onLaunch={handleLaunch}
              />
            </SectionErrorBoundary>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
