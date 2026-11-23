import { useEffect, useRef } from 'react';

/**
 * Runs `handler` when the page unloads: the window closing, which on Windows
 * and Linux is the quit, or Cmd+Q on macOS. The latest handler is used, so a
 * component can pass a fresh closure on every render.
 */
export function usePageHide(handler: () => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const onPageHide = () => latest.current();
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);
}
