import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFrequency } from '@/lib/utils/format';
import { useATCControllers } from '@/queries';
import type { Frequency } from '@/types/apt';
import { FrequencyType } from '@/types/apt';

interface FrequenciesSectionProps {
  frequencies: Frequency[];
  airportIcao?: string;
}

const FREQ_ORDER: FrequencyType[] = [
  FrequencyType.AWOS,
  FrequencyType.TOWER,
  FrequencyType.GROUND,
  FrequencyType.DELIVERY,
  FrequencyType.APPROACH,
  FrequencyType.CENTER,
  FrequencyType.CTAF,
  FrequencyType.UNICOM,
];

const FREQ_LABELS: Record<FrequencyType, string> = {
  [FrequencyType.AWOS]: 'ATIS/AWOS',
  [FrequencyType.TOWER]: 'TWR',
  [FrequencyType.GROUND]: 'GND',
  [FrequencyType.DELIVERY]: 'DEL',
  [FrequencyType.APPROACH]: 'APP',
  [FrequencyType.CENTER]: 'CTR',
  [FrequencyType.CTAF]: 'CTAF',
  [FrequencyType.UNICOM]: 'UNICOM',
};

const ATC_ROLE_LABELS: Record<string, string> = {
  ctr: 'CTR',
  app: 'APP',
  twr: 'TWR',
  gnd: 'GND',
  del: 'DEL',
};

export default function FrequenciesSection({ frequencies, airportIcao }: FrequenciesSectionProps) {
  const { t } = useTranslation();
  const { data: atcControllers = [] } = useATCControllers(airportIcao ?? null);

  const groupedFrequencies = useMemo(
    () =>
      frequencies.reduce<Partial<Record<FrequencyType, Frequency[]>>>((groups, freq) => {
        const existing = groups[freq.type] ?? [];
        return { ...groups, [freq.type]: [...existing, freq] };
      }, {}),
    [frequencies]
  );

  const handleCopy = (frequency: number) => {
    navigator.clipboard.writeText(formatFrequency(frequency));
  };

  if (frequencies.length === 0 && atcControllers.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">{t('sidebar.noFrequencies')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* X-Plane apt.dat frequencies */}
      {FREQ_ORDER.map((type) => {
        const freqs = groupedFrequencies[type];
        if (!freqs || freqs.length === 0) return null;

        return (
          <div key={type}>
            <h4 className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {FREQ_LABELS[type]}
            </h4>
            <div className="space-y-1">
              {freqs.map((freq, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between rounded bg-muted/50 p-2 transition-colors hover:bg-muted"
                >
                  <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                    {freq.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-foreground">
                      {formatFrequency(freq.frequency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(freq.frequency)}
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      title={t('sidebar.copyFrequency')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Navigraph ATC Controllers */}
      {atcControllers.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="mb-2 flex items-center gap-2">
            <Radio className="h-3 w-3 text-info" />
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('sidebar.atcControllers')}
            </h4>
            <Badge variant="secondary" className="px-1 py-0 text-xs">
              Navigraph
            </Badge>
          </div>
          <div className="space-y-1">
            {atcControllers.map((controller, i) => (
              <div key={i} className="group rounded bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-1.5 py-0 text-xs">
                      {ATC_ROLE_LABELS[controller.role] || controller.role.toUpperCase()}
                    </Badge>
                    <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                      {controller.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {controller.facilityId}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {controller.frequencies.map((freq, fi) => (
                    <Button
                      key={fi}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(freq)}
                      className="h-6 gap-1 px-2 font-mono text-xs hover:bg-muted"
                      title={t('sidebar.copyFrequency')}
                    >
                      {formatFrequency(freq)}
                      <Copy className="h-2.5 w-2.5 opacity-50" />
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
