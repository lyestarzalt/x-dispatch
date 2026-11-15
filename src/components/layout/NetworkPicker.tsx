import { useTranslation } from 'react-i18next';
import { Radar } from 'lucide-react';
import { VatsimWordmark } from '@/components/icons/BrandMarks';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils/helpers';
import { useNetworkTraffic } from '@/queries/useNetworkTraffic';
import { useMapStore } from '@/stores/mapStore';

const SWITCH =
  'data-[state=off]:bg-secondary/40 data-[state=off]:text-muted-foreground min-w-0 flex-1 justify-center data-[state=on]:ring-0';

/**
 * The same two network switches as the Layers panel, for places where a pilot
 * compares VATSIM and IVAO without leaving what they are looking at.
 */
export function NetworkPicker({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { network } = useNetworkTraffic();
  const setVatsimEnabled = useMapStore((s) => s.setVatsimEnabled);
  const setIvaoEnabled = useMapStore((s) => s.setIvaoEnabled);

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Toggle
        variant="subtle"
        size="xs"
        pressed={network === 'vatsim'}
        onPressedChange={(on) => setVatsimEnabled(on)}
        aria-label={t('toolbar.vatsim')}
        className={SWITCH}
      >
        <VatsimWordmark className="h-3.5" />
      </Toggle>
      <Toggle
        variant="subtle"
        size="xs"
        pressed={network === 'ivao'}
        onPressedChange={(on) => setIvaoEnabled(on)}
        aria-label="IVAO"
        className={SWITCH}
      >
        <Radar className="shrink-0" />
        IVAO
      </Toggle>
    </div>
  );
}
