/**
 * Hide the account name in home-folder paths before text leaves the machine.
 * Node's file errors quote the full path ("EPERM: rename 'C:\Users\Admin\...'"),
 * and a Sentry title built from one names the user. Pure, for both processes.
 */
const HOME_SEGMENT =
  /((?:^|[\s'"(=:])(?:[A-Za-z]:[\\/]Users[\\/]|\/Users\/|\/home\/))([^\\/'"\s]+)/g;

export function scrubUserPaths(text: string): string {
  return text.replace(HOME_SEGMENT, (_m, prefix: string) => `${prefix}<user>`);
}

/** The parts of a Sentry event that carry free text; the shape both SDKs share. */
interface ScrubbableEvent {
  message?: string;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: { message?: string }[];
}

/** For `beforeSend`: scrub the event in place and hand it back. */
export function scrubEventPaths<E extends ScrubbableEvent>(event: E): E {
  if (event.message) event.message = scrubUserPaths(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubUserPaths(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubUserPaths(crumb.message);
  }
  return event;
}
