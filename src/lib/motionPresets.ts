import type { Transition } from 'motion/react';

/**
 * Shared motion material so every surface moves alike.
 * Animations stick to transform/opacity only — they run on the compositor
 * and never add React re-renders or eat into the map's frame budget.
 */

export const overlayFade: Transition = { duration: 0.16, ease: 'easeOut' };

/** Dialogs and panels open with a quick, bounce-free spring. */
export const panelSpring: Transition = { type: 'spring', duration: 0.3, bounce: 0 };

/** Closing is faster than opening, like native windows. */
export const exitEase: Transition = { duration: 0.13, ease: 'easeIn' };

/** Celebration surfaces (landing card) get a touch of bounce. */
export const cardSpring: Transition = { type: 'spring', duration: 0.55, bounce: 0.3 };
