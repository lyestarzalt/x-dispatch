import { useTranslation } from 'react-i18next';
import { Check, Plane } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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
      {/* Preview */}
      <div className="relative min-h-[200px] flex-1 border-b bg-gradient-to-b from-muted/20 to-muted/5">
        {currentLiveryImage ? (
          <img
            src={currentLiveryImage}
            alt={aircraft.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Plane className="h-16 w-16 text-muted-foreground/10" />
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <div className="text-sm font-medium">{aircraft.name}</div>
          <div className="text-xs text-muted-foreground">
            {aircraft.manufacturer}
            {aircraft.author && ` · ${aircraft.author}`}
          </div>
        </div>
      </div>

      {/* Liveries */}
      <div className="flex h-[180px] flex-shrink-0 flex-col border-b">
        <div className="flex-shrink-0 border-b bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {t('launcher.liveries.count', { count: aircraft.liveries.length })}
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-5 gap-1 p-1.5">
            {aircraft.liveries.map((liv) => {
              const imgKey = `${aircraft.path}:${liv.name}`;
              const isSelected = selectedLivery === liv.name;

              return (
                <button
                  key={liv.name}
                  onClick={() => onSelectLivery(liv.name)}
                  className={cn(
                    'overflow-hidden rounded text-left transition-all',
                    isSelected
                      ? 'ring-2 ring-primary'
                      : 'hover:ring-1 hover:ring-muted-foreground/30'
                  )}
                >
                  <div className="relative aspect-[16/10] bg-muted/30">
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
                      <div className="flex h-full w-full items-center justify-center">
                        <Plane className="h-4 w-4 text-muted-foreground/20" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="px-0.5">
                    <div className="truncate text-center text-[9px]">{liv.displayName}</div>
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
