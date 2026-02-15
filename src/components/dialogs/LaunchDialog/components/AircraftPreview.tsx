import { useTranslation } from 'react-i18next';
import { Check, Fuel, Plane, Scale, Settings, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatWeight } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';
import { Aircraft } from '../types';

interface AircraftPreviewProps {
  aircraft: Aircraft | null;
  selectedLivery: string;
  aircraftImages: Record<string, string>;
  liveryImages: Record<string, string>;
  onSelectLivery: (livery: string) => void;
}

export function AircraftPreview({
  aircraft,
  selectedLivery,
  aircraftImages,
  liveryImages,
  onSelectLivery,
}: AircraftPreviewProps) {
  const { t } = useTranslation();
  const weightUnit = useSettingsStore((state) => state.map.units.weight);

  if (!aircraft) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t('launcher.selectAircraft')}
      </div>
    );
  }

  const currentLiveryImage =
    liveryImages[`${aircraft.path}:${selectedLivery}`] || aircraftImages[aircraft.path];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Preview Image */}
      <div className="relative flex-1 bg-gradient-to-b from-secondary/50 to-background">
        {currentLiveryImage ? (
          <img
            src={currentLiveryImage}
            alt={aircraft.name}
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
            <h2 className="xp-detail-heading">{aircraft.name}</h2>
            {aircraft.icao && (
              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {aircraft.icao}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {aircraft.manufacturer}
            {aircraft.studio && ` · ${aircraft.studio}`}
            {aircraft.author && !aircraft.studio && ` · ${aircraft.author}`}
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
              {aircraft.emptyWeight > 0 ? formatWeight(aircraft.emptyWeight, weightUnit) : '—'}
            </div>
          </div>

          {/* Max Weight */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="xp-label">{t('launcher.specs.maxWeight')}</span>
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {aircraft.maxWeight > 0 ? formatWeight(aircraft.maxWeight, weightUnit) : '—'}
            </div>
          </div>

          {/* Max Fuel */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="xp-label">{t('launcher.specs.maxFuel')}</span>
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {aircraft.maxFuel > 0 ? formatWeight(aircraft.maxFuel, weightUnit) : '—'}
            </div>
          </div>
        </div>

        {/* Tail Number (if available) */}
        {aircraft.tailNumber && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="xp-label">{t('launcher.specs.tailNumber')}</span>
            <span className="ml-auto font-mono text-sm text-primary">{aircraft.tailNumber}</span>
          </div>
        )}
      </div>

      {/* Liveries Section */}
      <div className="flex h-[160px] flex-shrink-0 flex-col">
        {/* Section Header - X-Plane style */}
        <div className="xp-section-heading mx-3 mb-0 mt-2 flex items-center justify-between">
          <span>{t('launcher.liveries.title')}</span>
          <span className="text-xs normal-case text-muted-foreground">
            {aircraft.liveries.length}
          </span>
        </div>

        {/* Livery Grid - X-Plane Tile Style */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-5 gap-1.5 p-2">
            {aircraft.liveries.map((liv) => {
              const imgKey = `${aircraft.path}:${liv.name}`;
              const isSelected = selectedLivery === liv.name;

              return (
                <button
                  key={liv.name}
                  type="button"
                  onClick={() => onSelectLivery(liv.name)}
                  title={liv.displayName}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isSelected ? 'bg-primary/5 ring-2 ring-primary' : 'bg-secondary hover:bg-accent'
                  )}
                >
                  {/* Tile Image */}
                  <div className="relative aspect-[16/10] w-full">
                    {liveryImages[imgKey] ? (
                      <img
                        src={liveryImages[imgKey]}
                        alt={liv.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : liv.name === 'Default' && aircraftImages[aircraft.path] ? (
                      <img
                        src={aircraftImages[aircraft.path]}
                        alt={liv.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Plane className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Selected indicator - X-Plane style settings icon */}
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
                      {liv.displayName}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
