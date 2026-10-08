import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { toastError } from '@/lib/utils/toastError';
import { trackEvent } from '@/queries';
import {
  type ComRadio,
  type ComSlot,
  useTuneRadio,
  useXPlaneStatus,
} from '@/queries/useXPlaneQuery';
import { TuneButton } from './TuneButton';

const TUNE_RADIOS: ReadonlyArray<ComRadio> = ['COM1', 'COM2'];

const TUNE_SLOTS: ReadonlyArray<{ slot: ComSlot; labelKey: string; toastKey: string }> = [
  {
    slot: 'active',
    labelKey: 'airportInfo.tune.active',
    toastKey: 'airportInfo.tune.toast.activeSet',
  },
  {
    slot: 'standby',
    labelKey: 'airportInfo.tune.standby',
    toastKey: 'airportInfo.tune.toast.standbySet',
  },
];

export function TuneStrip({ freq, onTuned }: { freq: string; onTuned: () => void }) {
  const { t } = useTranslation();
  const status = useXPlaneStatus();
  const tune = useTuneRadio();
  const simReachable = status.data === true;

  if (!freq) return null;

  if (!simReachable) {
    return (
      <p className="text-muted-foreground/70 text-2xs text-center font-mono tracking-wider uppercase">
        {t('airportInfo.tune.simOffline')}
      </p>
    );
  }

  const handleTune = async (radio: ComRadio, slot: ComSlot, toastKey: string) => {
    const result = await tune.mutateAsync({ radio, slot, freq });
    if (result.success) {
      toast.success(t(toastKey, { radio, freq }));
      trackEvent('frequency_tuned', {});
      onTuned();
    } else {
      toastError('radio_tune', t('airportInfo.tune.toast.failed', { radio }), {
        description: result.error,
      });
    }
  };

  return (
    <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-1.5 gap-y-1">
      {TUNE_SLOTS.map(({ slot, labelKey, toastKey }) => (
        <Fragment key={slot}>
          <span className="text-muted-foreground text-2xs font-mono tracking-wider uppercase">
            {t(labelKey)}
          </span>
          {TUNE_RADIOS.map((radio) => (
            <TuneButton
              key={radio}
              radio={radio}
              pending={tune.isPending}
              onClick={() => handleTune(radio, slot, toastKey)}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
