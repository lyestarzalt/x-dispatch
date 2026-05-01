import { type CSSProperties, useEffect, useState } from 'react';

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;

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
      className="flex h-9 w-full shrink-0 select-none items-center gap-2 border-b border-border/40 bg-background pl-3 text-xs text-muted-foreground"
      style={{
        ...dragStyle,
        // env(titlebar-area-*) is exposed by Window Controls Overlay; keep a
        // sensible fallback for the native min/max/close buttons on Windows.
        paddingRight:
          'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, calc(100vw - 138px)))',
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
