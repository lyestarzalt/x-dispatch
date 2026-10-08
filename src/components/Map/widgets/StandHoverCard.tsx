import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useSpring } from 'motion/react';
import type { StandHover } from '@/lib/airports/standIdentity';
import { STAND_TINT, WIDTH_CODE_WINGSPAN_M, airlineName } from '@/lib/airports/standIdentity';
import { cursorFollowSpring, quickFade } from '@/lib/motionPresets';
import { useStandHoverStore } from '@/stores/standHoverStore';

const MAX_AIRLINES = 6;
const CURSOR_OFFSET_PX = 14;
const SEPARATOR = ' · ';

/** Small card following the cursor over a stand with its size, operator and airlines. */
export default function StandHoverCard() {
  const hover = useStandHoverStore((s) => s.hover);
  if (!hover) return null;
  return <Card hover={hover} />;
}

function Card({ hover }: { hover: StandHover }) {
  const { t } = useTranslation();

  // Position lives in MotionValues: the spring runs on Motion's frameloop and
  // writes a compositor transform, so cursor moves never touch layout.
  const targetX = useMotionValue(hover.x + CURSOR_OFFSET_PX);
  const targetY = useMotionValue(hover.y + CURSOR_OFFSET_PX);
  const x = useSpring(targetX, cursorFollowSpring);
  const y = useSpring(targetY, cursorFollowSpring);
  useEffect(() => {
    targetX.set(hover.x + CURSOR_OFFSET_PX);
    targetY.set(hover.y + CURSOR_OFFSET_PX);
  }, [hover.x, hover.y, targetX, targetY]);

  const wingspan = hover.widthCode ? WIDTH_CODE_WINGSPAN_M[hover.widthCode] : undefined;
  const airlines = hover.airlines.slice(0, MAX_AIRLINES);
  const more = hover.airlines.length - airlines.length;

  return (
    <motion.div
      className="border-border bg-background/90 pointer-events-none absolute top-0 left-0 z-30 w-56 rounded-md border p-2.5 text-xs shadow-xl backdrop-blur"
      style={{ x, y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={quickFade}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: STAND_TINT[hover.operation] }}
        />
        <span className="truncate text-sm font-semibold">{hover.name}</span>
      </div>
      <div className="text-muted-foreground mt-1">
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
                className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]"
                title={name}
              >
                {name ?? code}
              </span>
            );
          })}
          {more > 0 && (
            <span className="text-muted-foreground px-1 py-0.5 text-[10px]">
              {t('stands.moreAirlines', { count: more })}
            </span>
          )}
        </div>
      )}
      <div className="text-muted-foreground mt-2 text-[10px]">{t('stands.clickToStart')}</div>
    </motion.div>
  );
}
