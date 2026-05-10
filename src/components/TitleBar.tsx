import { type CSSProperties, useEffect, useState } from 'react';
import { Bug } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/helpers';
import { useDebugStore } from '@/stores/debugStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { TABS } from './Map/widgets/DevDebugOverlay/types';

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

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
      <DebugMenu />
    </header>
  );
}

function DebugMenu() {
  const visible = useSettingsStore((s) => s.appearance.debugOverlay);
  const detached = useDebugStore((s) => s.detached);
  const togglePanel = useDebugStore((s) => s.togglePanel);
  const setDebugOverlay = useSettingsStore((s) => s.setDebugOverlay);

  if (!visible) return null;

  return (
    <div className="ml-auto flex items-center" style={noDragStyle}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs uppercase tracking-wider',
            'text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            detached.length > 0 && 'text-primary'
          )}
          aria-label="Debug panels (Ctrl+Shift+D to toggle)"
        >
          <Bug className="h-3 w-3" />
          <span>debug</span>
          {detached.length > 0 && (
            <span className="ml-0.5 rounded bg-primary/20 px-1 text-[10px]">{detached.length}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="xp-section-heading">Panels</DropdownMenuLabel>
          {TABS.map((tab) => {
            const isOpen = detached.some((d) => d.id === tab.id);
            return (
              <DropdownMenuItem
                key={tab.id}
                onSelect={(e) => {
                  e.preventDefault();
                  togglePanel(tab.id);
                }}
                className={cn('flex items-center justify-between', isOpen && 'text-primary')}
              >
                <span>{tab.label}</span>
                {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDebugOverlay(false)} className="text-xs">
            Hide debug menu (⌃⇧D)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
