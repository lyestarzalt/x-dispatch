import { useTranslation } from 'react-i18next';
import {
  STAND_TINT,
  type StandHover,
  WIDTH_CODE_WINGSPAN_M,
  airlineName,
} from '@/lib/airports/standIdentity';

const MAX_AIRLINES = 6;
const CURSOR_OFFSET_PX = 14;
const SEPARATOR = ' · ';

interface StandHoverCardProps {
  hover: StandHover | null;
}

/** Small card following the cursor over a stand with its size, operator and airlines. */
export default function StandHoverCard({ hover }: StandHoverCardProps) {
  const { t } = useTranslation();
  if (!hover) return null;

  const wingspan = hover.widthCode ? WIDTH_CODE_WINGSPAN_M[hover.widthCode] : undefined;
  const airlines = hover.airlines.slice(0, MAX_AIRLINES);
  const more = hover.airlines.length - airlines.length;

  return (
    <div
      className="pointer-events-none absolute z-30 w-56 rounded-md border border-border bg-background/90 p-2.5 text-xs shadow-lg backdrop-blur"
      style={{ left: hover.x + CURSOR_OFFSET_PX, top: hover.y + CURSOR_OFFSET_PX }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: STAND_TINT[hover.operation] }}
        />
        <span className="truncate text-sm font-semibold">{hover.name}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        {t(`stands.operation.${hover.operation}`)}
        {hover.widthCode && wingspan !== undefined && (
          <>
            {SEPARATOR}
            {t('stands.sizeClass', { code: hover.widthCode, m: wingspan })}
          </>
        )}
      </div>
      {airlines.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {airlines.map((code) => {
            const name = airlineName(code);
            return (
              <span
                key={code}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                title={name}
              >
                {name ?? code}
              </span>
            );
          })}
          {more > 0 && (
            <span className="px-1 py-0.5 text-[10px] text-muted-foreground">
              {t('stands.moreAirlines', { count: more })}
            </span>
          )}
        </div>
      )}
      <div className="mt-2 text-[10px] text-muted-foreground">{t('stands.clickToStart')}</div>
    </div>
  );
}
