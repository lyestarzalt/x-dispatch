/** App windows only ever show the bundled renderer or the dev server. */
export function isAllowedNavigation(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'file:' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}
