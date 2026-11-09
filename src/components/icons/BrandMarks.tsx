import { cn } from '@/lib/utils/helpers';
import discordSymbol from '../../../assets/discord-symbol.svg';
import kofiLogomark from '../../../assets/kofi-logomark.png';
import vatsimWordmark from '../../../assets/vatsim-wordmark.svg';

/*
 * Other organisations' marks, used as they publish them. The files and the
 * terms behind each are listed in assets/BRAND-ASSETS.md. None of these may
 * be recoloured or reshaped, so they are images, not currentColor glyphs.
 */

interface MarkProps {
  /** Height class, e.g. `h-3.5`; the width follows the mark's own ratio. */
  className?: string;
}

/**
 * The VATSIM wordmark without tagline, the variant VATSIM allows in web
 * assets. Shown in full colour whether the layer is on or off: the brand
 * guide forbids other colours, so the tile's own state styling says which.
 */
export function VatsimWordmark({ className }: MarkProps) {
  return (
    <img
      src={vatsimWordmark}
      alt="VATSIM"
      draggable={false}
      className={cn('h-3.5 w-auto shrink-0 object-contain', className)}
    />
  );
}

/** Discord's symbol in Blurple. Only ever placed next to the word "Discord". */
export function DiscordSymbol({ className }: MarkProps) {
  return (
    <img
      src={discordSymbol}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('h-3.5 w-auto shrink-0 object-contain', className)}
    />
  );
}

/** Ko-fi's cup logomark, for links to the project's Ko-fi page. */
export function KofiMark({ className }: MarkProps) {
  return (
    <img
      src={kofiLogomark}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('h-3.5 w-auto shrink-0 object-contain', className)}
    />
  );
}
