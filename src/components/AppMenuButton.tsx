import { type CSSProperties, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu as MenuIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type AppMenuNode, formatAccelerator } from '@/lib/nativeShell/menuSerialization';
import { cn } from '@/lib/utils/helpers';

const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

/**
 * Windows and Linux: the application menu behind one button in the title bar,
 * since the hidden title bar leaves no menu bar. Same template as macOS, same
 * accelerators; clicks go back to the native menu item.
 */
export function AppMenuButton() {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<AppMenuNode[]>([]);
  const platform = window.appAPI.platform;

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) return;
    void window.appAPI.getAppMenu().then(setMenu);
  }, []);

  const renderItems = (nodes: AppMenuNode[]) =>
    nodes.map((node) => {
      if (node.type === 'separator') return <DropdownMenuSeparator key={node.id} />;
      if (node.submenu) {
        return (
          <DropdownMenuSub key={node.id}>
            <DropdownMenuSubTrigger disabled={!node.enabled}>{node.label}</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="min-w-48">
                {renderItems(node.submenu)}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        );
      }
      return (
        <DropdownMenuItem
          key={node.id}
          disabled={!node.enabled}
          onSelect={() => void window.appAPI.clickMenuItem(node.id)}
        >
          <span className="min-w-0 flex-1 truncate">{node.label}</span>
          {node.accelerator && (
            <DropdownMenuShortcut>
              {formatAccelerator(node.accelerator, platform).join('+')}
            </DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
      );
    });

  return (
    <div style={noDragStyle} className="flex items-center">
      <DropdownMenu onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger
          aria-label={t('titleBar.appMenu')}
          className={cn(
            'text-muted-foreground hover:bg-muted/40 hover:text-foreground flex h-6 w-7 items-center justify-center rounded',
            'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none'
          )}
        >
          <MenuIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          {renderItems(menu)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
