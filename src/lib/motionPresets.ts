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

/** Enter-only micro transitions: tab switches, dropdowns, list reveals. */
export const quickFade: Transition = { duration: 0.14, ease: 'easeOut' };

/** Sliding selection indicators (sidebar nav, segmented controls). */
export const indicatorSpring: Transition = { type: 'spring', duration: 0.35, bounce: 0.15 };

/** Cursor followers (useSpring options): tight tracking with a hint of lag. */
export const cursorFollowSpring = { stiffness: 550, damping: 42 } as const;
