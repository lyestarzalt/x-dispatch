import { useTranslation } from 'react-i18next';
import { Fuel, Plane, Scale, Settings, Tag } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useAircraftImage } from '@/queries';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Livery } from '@/types/aircraft';

// Individual livery tile - uses TanStack Query for image loading
function LiveryTile({
  livery,
  isSelected,
  fallbackImage,
  onSelect,
}: {
  livery: Livery;
  isSelected: boolean;
  fallbackImage: string | undefined;
  onSelect: () => void;
}) {
  const { data: liveryImage } = useAircraftImage(livery.previewImage);
  // Use livery image, or fallback to main aircraft image for Default
  const displayImage = liveryImage || (livery.name === 'Default' ? fallbackImage : undefined);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={livery.displayName}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isSelected ? 'bg-primary/5 ring-2 ring-primary' : 'bg-secondary hover:bg-accent'
      )}
    >
      {/* Tile Image */}
      <div className="relative aspect-[16/10] w-full">
        {displayImage ? (
          <img src={displayImage} alt={livery.displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Plane className="h-4 w-4 text-muted-foreground/30" />
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/90">
            <Settings className="h-3 w-3 text-primary-foreground" />
          </div>
        )}

        {/* Hover overlay */}
        {!isSelected && (
          <div className="absolute inset-0 bg-primary/0 transition-colors group-hover:bg-primary/10" />
        )}
      </div>

      {/* Tile Label */}
      <div className="px-1 py-1">
        <div
          className={cn(
            'truncate text-center text-xs',
            isSelected ? 'font-medium text-primary' : 'text-muted-foreground'
          )}
        >
          {livery.displayName}
        </div>
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

  // TanStack Query for main aircraft image
  const { data: aircraftImage } = useAircraftImage(selectedAircraft?.previewImage ?? null);

  // Get current livery's image
  const currentLivery = selectedAircraft?.liveries.find((l) => l.name === selectedLivery);
  const { data: currentLiveryImage } = useAircraftImage(currentLivery?.previewImage ?? null);

  if (!selectedAircraft) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t('launcher.selectAircraft')}
      </div>
    );
  }

  // Use current livery image, or fall back to main aircraft image
  const previewImage = currentLiveryImage || aircraftImage;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Preview Image */}
      <div className="relative flex-1 bg-gradient-to-b from-secondary/50 to-background">
        {previewImage ? (
          <img
            src={previewImage}
            alt={selectedAircraft.name}
            className="h-full w-full object-contain p-4"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Plane className="h-20 w-20 text-muted-foreground/10" />
          </div>
        )}
      </div>

      {/* Aircraft Info Panel */}
      <div className="flex-shrink-0 border-y border-border bg-card">
        {/* Aircraft Name Header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="xp-detail-heading">{selectedAircraft.name}</h2>
            {selectedAircraft.icao && (
              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {selectedAircraft.icao}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {selectedAircraft.manufacturer}
            {selectedAircraft.studio && ` · ${selectedAircraft.studio}`}
            {selectedAircraft.author && !selectedAircraft.studio && ` · ${selectedAircraft.author}`}
          </p>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-3 divide-x divide-border">
          {/* Empty Weight */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="xp-label">{t('launcher.specs.emptyWeight')}</span>
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {selectedAircraft.emptyWeight > 0
                ? formatWeight(selectedAircraft.emptyWeight, weightUnit)
                : '—'}
            </div>
          </div>

          {/* Max Weight */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="xp-label">{t('launcher.specs.maxWeight')}</span>
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {selectedAircraft.maxWeight > 0
                ? formatWeight(selectedAircraft.maxWeight, weightUnit)
                : '—'}
            </div>
          </div>

          {/* Max Fuel */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="xp-label">{t('launcher.specs.maxFuel')}</span>
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {selectedAircraft.maxFuel > 0
                ? formatWeight(selectedAircraft.maxFuel, weightUnit)
                : '—'}
            </div>
          </div>
        </div>

        {/* Tail Number (if available) */}
        {selectedAircraft.tailNumber && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="xp-label">{t('launcher.specs.tailNumber')}</span>
            <span className="ml-auto font-mono text-sm text-primary">
              {selectedAircraft.tailNumber}
            </span>
          </div>
        )}
      </div>

      {/* Liveries Section */}
      <div className="flex h-[160px] flex-shrink-0 flex-col">
        {/* Section Header */}
        <div className="xp-section-heading mx-3 mb-0 mt-2 flex items-center justify-between">
          <span>{t('launcher.liveries.title')}</span>
          <span className="text-xs normal-case text-muted-foreground">
            {selectedAircraft.liveries.length}
          </span>
        </div>

        {/* Livery Grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-5 gap-1.5 p-2">
            {selectedAircraft.liveries.map((liv) => (
              <LiveryTile
                key={liv.name}
                livery={liv}
                isSelected={selectedLivery === liv.name}
                fallbackImage={aircraftImage ?? undefined}
                onSelect={() => setSelectedLivery(liv.name)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
