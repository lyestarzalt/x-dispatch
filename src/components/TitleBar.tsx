import { type CSSProperties, useEffect, useState } from 'react';

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;

const isMac = typeof window !== 'undefined' && window.appAPI?.platform === 'darwin';

// macOS reserves the top-left corner for the native traffic-light buttons
// when titleBarStyle: 'hiddenInset' is set in main.ts. 78px is the standard
// inset Apple uses; matches Finder, Safari, Xcode, etc.
const MAC_TRAFFIC_LIGHT_OFFSET = '78px';

// Window Controls Overlay (Win/Linux) exposes its width via the
// `env(titlebar-area-*)` CSS env vars. We pad-right by whatever's left of
// the viewport so our content doesn't slide under the OS controls.
const WIN_LINUX_CONTROLS_PAD =
  'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, calc(100vw - 138px)))';

export function TitleBar() {
  const [version, setVersion] = useState('');
  const [installation, setInstallation] = useState('');

  useEffect(() => {
    window.appAPI.getVersion().then(setVersion);
    window.xplaneAPI.getActiveInstallation().then((inst) => {
      if (inst) setInstallation(inst.name);
    });
  }, []);

  return (
    <header
      className="flex h-9 w-full shrink-0 select-none items-center gap-2 border-b border-border/40 bg-background text-xs text-muted-foreground"
      style={{
        ...dragStyle,
        paddingLeft: isMac ? MAC_TRAFFIC_LIGHT_OFFSET : '0.75rem',
        paddingRight: isMac ? '0.75rem' : WIN_LINUX_CONTROLS_PAD,
      }}
    >
      <span className="font-medium tracking-tight text-foreground">X-Dispatch</span>
      {version && <span className="font-mono">v{version}</span>}
      {installation && (
        <>
          <span className="text-border">·</span>
          <span className="truncate text-primary">{installation}</span>
        </>
      )}
    </header>
  );
}
