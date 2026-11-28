import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Folder,
  Fuel,
  Image as ImageIcon,
  Plane,
  Scale,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { aircraftStudio, aircraftVersionLabel } from '@/lib/utils/aircraftStudio';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useAircraftImage } from '@/queries';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Livery } from '@/types/aircraft';
import {
  LIVERY_GAP,
  LIVERY_PADDING,
  LIVERY_THUMB_WIDTH,
  liveryCardHeight,
  liveryGridHeight,
} from './liveryGrid';

const LIVERY_VIEWPORT_CLASS = 'snap-y snap-mandatory scroll-p-3';

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
        <Plane className="text-muted-foreground/10 h-20 w-20" />
      )}
    </div>
  );
}

// Livery thumbnail card for selection grid
function LiveryCard({
  livery,
  isSelected,
  fallbackImage,
  height,
  onClick,
}: {
  livery: Livery;
  isSelected: boolean;
  fallbackImage: string | undefined;
  /** Card height in CSS pixels; the picture takes what the name leaves. */
  height: number;
  onClick: () => void;
}) {
  const { data: liveryImage } = useAircraftImage(livery.previewImage);
  const displayImage = liveryImage || (livery.name === 'Default' ? fallbackImage : undefined);

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      tooltip={livery.displayName}
      style={{ height }}
      className={cn(
        'group snap-start flex-col overflow-hidden border p-0',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'bg-secondary hover:border-border hover:bg-accent border-transparent'
      )}
    >
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        {displayImage ? (
          <img src={displayImage} alt={livery.displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <Plane className="text-muted-foreground/20 h-5 w-5" />
          </div>
        )}
      </div>
      <div className="w-full min-w-0 flex-shrink-0 px-2 py-1">
        <span
          className={cn(
            'block truncate text-center text-sm',
            isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
          )}
        >
          {livery.displayName}
        </span>
      </div>
    </Button>
  );
}

export function AircraftPreview() {
  const { t } = useTranslation();
  const weightUnit = useSettingsStore((state) => state.map.units.weight);

  // Zustand store
  const selectedAircraft = useLaunchStore((s) => s.selectedAircraft);
  const selectedLivery = useLaunchStore((s) => s.selectedLivery);
  const setSelectedLivery = useLaunchStore((s) => s.setSelectedLivery);
  const thumbWidth = useLaunchStore((s) => s.liveryThumbWidth);
  const setThumbWidth = useLaunchStore((s) => s.setLiveryThumbWidth);

  // TanStack Query for main aircraft image (fallback)
  const { data: aircraftImage } = useAircraftImage(selectedAircraft?.previewImage ?? null);

  // Find current livery index
  const rawIndex = selectedAircraft?.liveries.findIndex((l) => l.name === selectedLivery) ?? -1;
  const currentIndex = rawIndex >= 0 ? rawIndex : 0;
  const currentLivery = selectedAircraft?.liveries[currentIndex];

  // Navigation handlers
  const goToPrevious = () => {
    if (!selectedAircraft) return;
    const newIndex = currentIndex <= 0 ? selectedAircraft.liveries.length - 1 : currentIndex - 1;
    const livery = selectedAircraft.liveries[newIndex];
    if (!livery) return;
    setSelectedLivery(livery.name);
  };

  const goToNext = () => {
    if (!selectedAircraft) return;
    const newIndex = currentIndex >= selectedAircraft.liveries.length - 1 ? 0 : currentIndex + 1;
    const livery = selectedAircraft.liveries[newIndex];
    if (!livery) return;
    setSelectedLivery(livery.name);
  };

  const selectLivery = (index: number) => {
    if (!selectedAircraft) return;
    const livery = selectedAircraft.liveries[index];
    if (!livery) return;
    setSelectedLivery(livery.name);
  };

  if (!selectedAircraft) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        {t('launcher.selectAircraft')}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Aircraft Preview with Info */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Aircraft Info Header */}
        <div className="from-background flex-shrink-0 bg-gradient-to-b to-transparent px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-foreground text-xl font-semibold">{selectedAircraft.name}</h2>
                {selectedAircraft.icao && (
                  <Badge variant="secondary" className="font-mono">
                    {selectedAircraft.icao}
                  </Badge>
                )}
                {/* Which X-Plane's Plane Maker saved the .acf: an XP11 aircraft runs, but was not built for 12 */}
                {selectedAircraft.xplaneVersion && (
                  <Badge
                    variant="outline"
                    className="font-mono"
                    title={t('launcher.xplaneVersionTitle', {
                      version: selectedAircraft.xplaneVersion,
                    })}
                  >
                    {t('launcher.xplaneVersion', { version: selectedAircraft.xplaneVersion })}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                <span>{selectedAircraft.manufacturer}</span>
                {aircraftStudio(selectedAircraft) && (
                  <span className="text-foreground/80" title={selectedAircraft.author}>
                    {aircraftStudio(selectedAircraft)}
                  </span>
                )}
                {aircraftVersionLabel(selectedAircraft) && (
                  <span className="font-mono text-xs">
                    {aircraftVersionLabel(selectedAircraft)}
                  </span>
                )}
                {selectedAircraft.emptyWeight > 0 && (
                  <>
                    <span className="bg-border h-3 w-px shrink-0" aria-hidden />
                    <span className="flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5" />
                      {formatWeight(selectedAircraft.emptyWeight, weightUnit)}
                    </span>
                  </>
                )}
                {selectedAircraft.maxFuel > 0 && (
                  <>
                    <span className="bg-border h-3 w-px shrink-0" aria-hidden />
                    <span className="flex items-center gap-1">
                      <Fuel className="h-3.5 w-3.5" />
                      {formatWeight(selectedAircraft.maxFuel, weightUnit)}
                    </span>
                  </>
                )}
                {selectedAircraft.tailNumber && (
                  <>
                    <span className="bg-border h-3 w-px shrink-0" aria-hidden />
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      <span className="text-primary font-mono font-medium">
                        {selectedAircraft.tailNumber}
                      </span>
                    </span>
                  </>
                )}
              </div>
              {/* The file X-Plane loads: copies of one aircraft differ only here. */}
              <div
                className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1 font-mono text-xs"
                title={selectedAircraft.path}
              >
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate">{selectedAircraft.path}</span>
              </div>
            </div>
            <div className="bg-secondary/80 flex-shrink-0 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-medium">
                {currentLivery?.displayName ?? t('launcher.liveries.default')}
              </span>
              <span className="text-muted-foreground ml-2 text-sm">
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
                className="absolute top-1/2 left-3 h-8 w-8 -translate-y-1/2 rounded-full"
                onClick={goToPrevious}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">{t('launcher.liveries.previousLivery')}</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2 rounded-full"
                onClick={goToNext}
              >
                <ArrowRight className="h-4 w-4" />
                <span className="sr-only">{t('launcher.liveries.nextLivery')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Livery Selection Grid - Shows 2 rows, scrolls if more */}
      <div className="bg-card/50 flex flex-shrink-0 flex-col">
        <div className="border-border/30 flex flex-shrink-0 items-center justify-between gap-4 border-b px-4 py-2">
          <span className="text-muted-foreground min-w-0 truncate text-xs font-medium tracking-wider uppercase">
            {t('launcher.liveries.title')}
            <span className="ml-2 font-mono">{selectedAircraft.liveries.length}</span>
          </span>
          <div
            className="flex shrink-0 items-center gap-2"
            title={t('launcher.liveries.thumbnailSize')}
          >
            <ImageIcon className="text-muted-foreground h-3 w-3" aria-hidden />
            <Slider
              aria-label={t('launcher.liveries.thumbnailSize')}
              className="w-28"
              min={LIVERY_THUMB_WIDTH.min}
              max={LIVERY_THUMB_WIDTH.max}
              step={LIVERY_THUMB_WIDTH.step}
              value={[thumbWidth]}
              onValueChange={([width]) => {
                if (width !== undefined) setThumbWidth(width);
              }}
            />
            <ImageIcon className="text-muted-foreground h-4 w-4" aria-hidden />
          </div>
        </div>
        {/* Two rows at the chosen size, but never more than the preview above can spare. */}
        <ScrollArea
          viewportClassName={LIVERY_VIEWPORT_CLASS}
          style={{ maxHeight: `min(${liveryGridHeight(thumbWidth)}px, 45vh)` }}
        >
          <div
            className="grid"
            style={{
              gap: LIVERY_GAP,
              padding: LIVERY_PADDING,
              gridTemplateColumns: `repeat(auto-fill, minmax(${thumbWidth}px, 1fr))`,
            }}
          >
            {selectedAircraft.liveries.map((livery, index) => (
              <LiveryCard
                key={livery.name}
                livery={livery}
                isSelected={selectedLivery === livery.name}
                fallbackImage={aircraftImage ?? undefined}
                height={liveryCardHeight(thumbWidth)}
                onClick={() => selectLivery(index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
