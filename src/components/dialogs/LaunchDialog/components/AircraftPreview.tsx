import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Fuel, Plane, Scale, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useAircraftImage } from '@/queries';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Livery } from '@/types/aircraft';

// Livery grid layout constants (in pixels)
const LIVERY_CARD_HEIGHT = 80;
const LIVERY_GAP = 12;
const LIVERY_PADDING = 12;
const LIVERY_VISIBLE_ROWS = 2;

// Main preview image for selected livery
function LiveryPreview({
  livery,
  fallbackImage,
}: {
  livery: Livery;
  fallbackImage: string | undefined;
}) {
  const { data: liveryImage } = useAircraftImage(livery.previewImage);
  const displayImage = liveryImage || (livery.name === 'Default' ? fallbackImage : undefined);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {displayImage ? (
        <img
          src={displayImage}
          alt={livery.displayName}
          className="h-full w-full object-contain p-4"
        />
      ) : (
        <Plane className="h-20 w-20 text-muted-foreground/10" />
      )}
    </div>
  );
}

// Livery thumbnail card for selection grid
function LiveryCard({
  livery,
  isSelected,
  fallbackImage,
  onClick,
}: {
  livery: Livery;
  isSelected: boolean;
  fallbackImage: string | undefined;
  onClick: () => void;
}) {
  const { data: liveryImage } = useAircraftImage(livery.previewImage);
  const displayImage = liveryImage || (livery.name === 'Default' ? fallbackImage : undefined);

  return (
    <button
      type="button"
      onClick={onClick}
      title={livery.displayName}
      className={cn(
        'group flex h-20 flex-col overflow-hidden rounded-lg border transition-all',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent bg-secondary hover:border-border hover:bg-accent'
      )}
    >
      <div className="relative flex-1 overflow-hidden">
        {displayImage ? (
          <img src={displayImage} alt={livery.displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Plane className="h-5 w-5 text-muted-foreground/20" />
          </div>
        )}
      </div>
      <div className="flex-shrink-0 px-2 py-1">
        <span
          className={cn(
            'block truncate text-center text-xs',
            isSelected ? 'font-medium text-primary' : 'text-muted-foreground'
          )}
        >
          {livery.displayName}
        </span>
      </div>
    </button>
  );
}

export function AircraftPreview() {
  const { t } = useTranslation();
  const weightUnit = useSettingsStore((state) => state.map.units.weight);

  // Zustand store
  const selectedAircraft = useLaunchStore((s) => s.selectedAircraft);
  const selectedLivery = useLaunchStore((s) => s.selectedLivery);
  const setSelectedLivery = useLaunchStore((s) => s.setSelectedLivery);

  // TanStack Query for main aircraft image (fallback)
  const { data: aircraftImage } = useAircraftImage(selectedAircraft?.previewImage ?? null);

  // Find current livery index
  const currentIndex = selectedAircraft?.liveries.findIndex((l) => l.name === selectedLivery) ?? 0;
  const currentLivery = selectedAircraft?.liveries[currentIndex];

  // Navigation handlers
  const goToPrevious = () => {
    if (!selectedAircraft) return;
    const newIndex = currentIndex <= 0 ? selectedAircraft.liveries.length - 1 : currentIndex - 1;
    setSelectedLivery(selectedAircraft.liveries[newIndex].name);
  };

  const goToNext = () => {
    if (!selectedAircraft) return;
    const newIndex = currentIndex >= selectedAircraft.liveries.length - 1 ? 0 : currentIndex + 1;
    setSelectedLivery(selectedAircraft.liveries[newIndex].name);
  };

  const selectLivery = (index: number) => {
    if (!selectedAircraft) return;
    setSelectedLivery(selectedAircraft.liveries[index].name);
  };

  if (!selectedAircraft) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t('launcher.selectAircraft')}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Aircraft Preview with Info */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Aircraft Info Header */}
        <div className="flex-shrink-0 bg-gradient-to-b from-background to-transparent px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{selectedAircraft.name}</h2>
                {selectedAircraft.icao && (
                  <span className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {selectedAircraft.icao}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{selectedAircraft.manufacturer}</span>
                {selectedAircraft.emptyWeight > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5" />
                      {formatWeight(selectedAircraft.emptyWeight, weightUnit)}
                    </span>
                  </>
                )}
                {selectedAircraft.maxFuel > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <Fuel className="h-3.5 w-3.5" />
                      {formatWeight(selectedAircraft.maxFuel, weightUnit)}
                    </span>
                  </>
                )}
                {selectedAircraft.tailNumber && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      <span className="font-mono font-medium text-primary">
                        {selectedAircraft.tailNumber}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 rounded-lg bg-secondary/80 px-2.5 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-medium">{currentLivery?.displayName ?? 'Default'}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {currentIndex + 1}/{selectedAircraft.liveries.length}
              </span>
            </div>
          </div>
        </div>

        {/* Preview Image with Nav Buttons */}
        <div className="relative min-h-0 flex-1">
          {currentLivery && (
            <LiveryPreview livery={currentLivery} fallbackImage={aircraftImage ?? undefined} />
          )}

          {/* Previous/Next Buttons */}
          {selectedAircraft.liveries.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                onClick={goToPrevious}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Previous livery</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                onClick={goToNext}
              >
                <ArrowRight className="h-4 w-4" />
                <span className="sr-only">Next livery</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Livery Selection Grid - Shows 2 rows, scrolls if more */}
      <div className="flex flex-shrink-0 flex-col bg-card/50">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border/30 px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('launcher.liveries.title')}
          </span>
          <span className="text-xs text-muted-foreground">{selectedAircraft.liveries.length}</span>
        </div>
        <ScrollArea
          style={{
            maxHeight:
              LIVERY_CARD_HEIGHT * LIVERY_VISIBLE_ROWS +
              LIVERY_GAP * (LIVERY_VISIBLE_ROWS - 1) +
              LIVERY_PADDING * 2,
          }}
        >
          <div className="grid grid-cols-4 gap-3 p-3">
            {selectedAircraft.liveries.map((livery, index) => (
              <LiveryCard
                key={livery.name}
                livery={livery}
                isSelected={selectedLivery === livery.name}
                fallbackImage={aircraftImage ?? undefined}
                onClick={() => selectLivery(index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
