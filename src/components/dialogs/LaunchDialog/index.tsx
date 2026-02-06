import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
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
  const [useSystemTime, setUseSystemTime] = useState(false);
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

  // Launch
  const handleLaunch = async () => {
    if (!selectedAircraft || !startPosition) return;
    setIsLoading(true);
    setLaunchError(null);

    try {
      // Determine weather definition
      const weatherPreset = weatherPresets.find((w) => w.name.toLowerCase() === selectedWeather);
      const weatherDefinition = weatherPreset?.definition || '';
      const weatherName = weatherPreset?.name || selectedWeather;

      // Calculate fuel tank weights (auto distribution)
      const tankCount = selectedAircraft.tankNames.length || 2;
      const totalFuel = selectedAircraft.maxFuel * (fuelPercentage / 100);
      const tankWeights = new Array(9).fill(0);
      if (tankCount >= 2) {
        tankWeights[0] = totalFuel / 2;
        tankWeights[2] = totalFuel / 2;
      } else {
        tankWeights[0] = totalFuel;
      }

      const now = new Date();
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
      );

      const config = {
        aircraft: selectedAircraft,
        livery: selectedLivery,
        fuel: { percentage: fuelPercentage, tankWeights },
        startPosition: {
          type: startPosition.type,
          airport: startPosition.airport,
          position: startPosition.name,
        },
        time: {
          dayOfYear,
          timeInHours: timeOfDay,
          latitude: startPosition.latitude,
          longitude: startPosition.longitude,
          useSystemTime,
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
    } catch (err) {
      window.appAPI.log.error('X-Plane launch error', err);
      setLaunchError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

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

            <AircraftPreview
              aircraft={selectedAircraft}
              selectedLivery={selectedLivery}
              aircraftImages={aircraftImages}
              liveryImages={liveryImages}
              onSelectLivery={setSelectedLivery}
            />

            <FlightConfig
              aircraft={selectedAircraft}
              startPosition={startPosition}
              selectedLivery={selectedLivery}
              timeOfDay={timeOfDay}
              selectedWeather={selectedWeather}
              fuelPercentage={fuelPercentage}
              useSystemTime={useSystemTime}
              coldAndDark={coldAndDark}
              isLoading={isLoading}
              launchError={launchError}
              onTimeChange={setTimeOfDay}
              onWeatherChange={setSelectedWeather}
              onFuelChange={setFuelPercentage}
              onSystemTimeChange={setUseSystemTime}
              onColdAndDarkChange={setColdAndDark}
              onLaunch={handleLaunch}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
