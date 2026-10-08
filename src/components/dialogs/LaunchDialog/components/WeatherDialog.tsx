import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Plus, X } from 'lucide-react';
import {
  FULL_SCREEN_DIALOG,
  FULL_SCREEN_DIALOG_HEADER,
} from '@/components/dialogs/fullScreenDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPanel, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/helpers';
import { useTrackFeatureOpened } from '@/queries';
import { useLaunchStore } from '@/stores/launchStore';
import { AltitudeDiagram, type SelectedLayer } from './AltitudeDiagram';
import { AtmosphericPanel } from './weather/AtmosphericPanel';
import { CloudLayerProperties } from './weather/CloudLayerProperties';
import { SectionHeader } from './weather/SectionHeader';
import { WindLayerProperties } from './weather/WindLayerProperties';

// ─── Props ──────────────────────────────────────────────────────────────────

interface WeatherDialogProps {
  open: boolean;
  onClose: () => void;
  airportElevationFt?: number;
}

// ─── Main Dialog ────────────────────────────────────────────────────────────

export function WeatherDialog({ open, onClose, airportElevationFt = 0 }: WeatherDialogProps) {
  useTrackFeatureOpened('weather', open);
  const { t } = useTranslation();
  const weatherConfig = useLaunchStore((s) => s.weatherConfig);
  const updateCustomWeather = useLaunchStore((s) => s.updateCustomWeather);
  const addCloudLayer = useLaunchStore((s) => s.addCloudLayer);
  const removeCloudLayer = useLaunchStore((s) => s.removeCloudLayer);
  const updateCloudLayer = useLaunchStore((s) => s.updateCloudLayer);
  const addWindLayer = useLaunchStore((s) => s.addWindLayer);
  const removeWindLayer = useLaunchStore((s) => s.removeWindLayer);
  const updateWindLayer = useLaunchStore((s) => s.updateWindLayer);

  const { mode, custom } = weatherConfig;
  const isReal = mode === 'real';

  const [selectedLayer, setSelectedLayer] = useState<SelectedLayer | null>(null);

  const validSelection = (() => {
    if (!selectedLayer) return null;
    if (selectedLayer.kind === 'cloud' && selectedLayer.index < custom.clouds.length)
      return selectedLayer;
    if (selectedLayer.kind === 'wind' && selectedLayer.index < custom.wind.length)
      return selectedLayer;
    return null;
  })();

  const handleAddCloud = useCallback(() => {
    const nextIndex = custom.clouds.length;
    addCloudLayer();
    setSelectedLayer({ kind: 'cloud', index: nextIndex });
  }, [addCloudLayer, custom.clouds.length]);

  const handleAddWind = useCallback(() => {
    const nextIndex = custom.wind.length;
    addWindLayer();
    setSelectedLayer({ kind: 'wind', index: nextIndex });
  }, [addWindLayer, custom.wind.length]);

  const handleRemoveCloud = useCallback(
    (index: number) => {
      removeCloudLayer(index);
      setSelectedLayer(null);
    },
    [removeCloudLayer]
  );

  const handleRemoveWind = useCallback(
    (index: number) => {
      removeWindLayer(index);
      setSelectedLayer(null);
    },
    [removeWindLayer]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPanel className={cn(FULL_SCREEN_DIALOG, 'flex-col')} aria-describedby={undefined}>
        <VisuallyHidden.Root>
          <DialogTitle>{t('launcher.weatherDialog.title')}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Header */}
        <div className={FULL_SCREEN_DIALOG_HEADER}>
          <span className="text-sm font-medium">{t('launcher.weatherDialog.title')}</span>
          <div className="flex items-center gap-2">
            {!isReal && (
              <>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleAddCloud}
                  disabled={custom.clouds.length >= 3}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('launcher.weatherDialog.addCloud')}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleAddWind}
                  disabled={custom.wind.length >= 13}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('launcher.weatherDialog.addWind')}
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Body — 3 panel layout */}
        <div className="flex min-h-0 flex-1">
          {/* LEFT — Layer Properties */}
          <div
            className={cn(
              'border-border w-[280px] shrink-0 overflow-y-auto border-r p-4',
              isReal && 'pointer-events-none opacity-40'
            )}
          >
            <SectionHeader text={t('launcher.weatherDialog.layerProperties')} />
            {(() => {
              if (validSelection?.kind === 'cloud') {
                const cloudLayer = custom.clouds[validSelection.index];
                if (cloudLayer) {
                  return (
                    <CloudLayerProperties
                      index={validSelection.index}
                      layer={cloudLayer}
                      onUpdate={(data) => updateCloudLayer(validSelection.index, data)}
                      onRemove={() => handleRemoveCloud(validSelection.index)}
                    />
                  );
                }
              }
              if (validSelection?.kind === 'wind') {
                const windLayer = custom.wind[validSelection.index];
                if (windLayer) {
                  return (
                    <WindLayerProperties
                      index={validSelection.index}
                      layer={windLayer}
                      onUpdate={(data) => updateWindLayer(validSelection.index, data)}
                      onRemove={() => handleRemoveWind(validSelection.index)}
                    />
                  );
                }
              }
              return null;
            })() ?? (
              <p className="text-muted-foreground mt-8 text-center text-sm">
                {t('launcher.weatherDialog.emptyHint')}
              </p>
            )}
          </div>

          {/* CENTER — Altitude Diagram */}
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col p-2',
              isReal && 'pointer-events-none opacity-40'
            )}
          >
            <AltitudeDiagram
              clouds={custom.clouds}
              wind={custom.wind}
              airportElevationFt={airportElevationFt}
              selectedLayer={validSelection}
              onSelectLayer={setSelectedLayer}
              onUpdateCloud={(i, data) => updateCloudLayer(i, data)}
              onUpdateWind={(i, data) => updateWindLayer(i, data)}
              disabled={isReal}
            />
          </div>

          {/* RIGHT — Atmospheric + Environment */}
          <div className="border-border w-[320px] shrink-0 overflow-y-auto border-l p-4">
            <AtmosphericPanel custom={custom} isReal={isReal} onUpdate={updateCustomWeather} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-border bg-card flex flex-shrink-0 justify-end border-t px-4 py-2.5">
          <Button onClick={onClose} size="sm">
            {t('launcher.weatherDialog.done')}
          </Button>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
