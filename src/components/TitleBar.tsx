import { type CSSProperties, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      className="border-border/40 bg-background text-muted-foreground relative z-[70] flex h-9 w-full shrink-0 items-center gap-2 border-b text-xs select-none"
      style={{
        ...dragStyle,
        paddingLeft: isMac ? MAC_TRAFFIC_LIGHT_OFFSET : '0.75rem',
        paddingRight: isMac ? '0.75rem' : WIN_LINUX_CONTROLS_PAD,
      }}
    >
      <span className="text-foreground font-medium tracking-tight">X-Dispatch</span>
      {version && <span className="font-mono">{t('titleBar.version', { version })}</span>}
      {installation && (
        <>
          <span className="text-border">·</span>
          <span className="text-primary truncate">{installation}</span>
        </>
      )}
      <DebugMenu />
    </header>
  );
}

function DebugMenu() {
  const { t } = useTranslation();
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
            'flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs tracking-wider uppercase',
            'text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground',
            'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
            detached.length > 0 && 'text-primary'
          )}
          aria-label="Debug panels (Ctrl+Shift+D to toggle)"
        >
          <Bug className="h-3 w-3" />
          <span>{t('titleBar.debug')}</span>
          {detached.length > 0 && (
            <span className="bg-primary/20 ml-0.5 rounded px-1 text-[10px]">{detached.length}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="xp-section-heading">
            {t('titleBar.panels')}
          </DropdownMenuLabel>
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
                {isOpen && <span className="bg-primary h-1.5 w-1.5 rounded-full" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDebugOverlay(false)} className="text-xs">
            {t('titleBar.hideDebugMenu')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
