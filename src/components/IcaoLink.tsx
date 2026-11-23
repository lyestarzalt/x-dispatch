import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';

interface IcaoLinkProps {
  icao: string;
  onClick: () => void;
  /** Text size for the surface it sits on (`text-xl`, `text-3xl`). */
  className?: string;
}

/** An airport code that opens that airport when clicked. */
export function IcaoLink({ icao, onClick, className }: IcaoLinkProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant="link"
      onClick={onClick}
      className={cn('h-auto p-0 font-mono font-bold tracking-tight', className)}
      aria-label={t('simbriefDialog.header.goToAirportLayoutAria', { icao })}
    >
      {icao}
    </Button>
  );
}
