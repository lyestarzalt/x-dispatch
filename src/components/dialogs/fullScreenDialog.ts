/**
 * Shell for multi-panel dialogs (launcher, weather, add-ons, logbook): 24px from every
 * edge, starting below the 36px title bar so its caption buttons stay reachable. Flat,
 * since the overlay already separates the dialog from the app.
 */
export const FULL_SCREEN_DIALOG =
  'border-border bg-background fixed inset-x-6 top-[60px] bottom-6 z-50 flex overflow-hidden rounded-lg border';

/** Title row shared by the full-screen dialogs. */
export const FULL_SCREEN_DIALOG_HEADER =
  'border-border bg-card flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4 select-none';
