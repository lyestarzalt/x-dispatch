import { useTranslation } from 'react-i18next';
import { IcaoCode } from '@/components/ui/icao-code';
import { useAppStore } from '@/stores/appStore';

/**
 * One end of the route on the folded planner. Clicking the code opens that airport, as the
 * large code in the unfolded header does; an empty end is four dashes and does nothing.
 */
export function RailEnd({ icao }: { icao: string | undefined }) {
  const { t } = useTranslation();
  if (!icao) return <IcaoCode>----</IcaoCode>;
  return (
    <IcaoCode
      onClick={() => useAppStore.getState().requestSelectAirport(icao)}
      aria-label={t('simbriefDialog.header.goToAirportLayoutAria', { icao })}
    >
      {icao}
    </IcaoCode>
  );
}
