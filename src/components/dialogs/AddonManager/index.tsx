// src/components/dialogs/AddonManager/index.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { FolderOpen, Layers, Package, PackagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/helpers';
import { BrowserTab } from './tabs/BrowserTab';
import { InstallerTab } from './tabs/InstallerTab';
import { SceneryTab } from './tabs/SceneryTab';

interface AddonManagerProps {
  open: boolean;
  onClose: () => void;
}

type TabValue = 'scenery' | 'installed' | 'installer';

interface NavItem {
  id: TabValue;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'scenery',
    labelKey: 'addonManager.tabs.scenery',
    descKey: 'addonManager.nav.sceneryDesc',
    icon: Layers,
  },
  {
    id: 'installed',
    labelKey: 'addonManager.tabs.installed',
    descKey: 'addonManager.nav.installedDesc',
    icon: Package,
  },
  {
    id: 'installer',
    labelKey: 'addonManager.tabs.installer',
    descKey: 'addonManager.nav.installerDesc',
    icon: PackagePlus,
  },
];

export function AddonManager({ open, onClose }: AddonManagerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>('installed');

  const handleOpenXPlaneFolder = async () => {
    const xplanePath = await window.xplaneAPI.getPath();
    if (xplanePath) {
      window.appAPI.openPath(xplanePath);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="border-border bg-background fixed inset-x-6 top-[60px] bottom-6 z-50 flex overflow-hidden rounded-xl border shadow-2xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{t('addonManager.title')}</DialogTitle>
          </VisuallyHidden.Root>

          {/* Sidebar Navigation */}
          <nav className="border-border bg-card/50 flex w-56 shrink-0 flex-col border-r">
            {/* Sidebar Header */}
            <div className="border-border flex h-14 items-center gap-3 border-b px-4">
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                <Package className="text-primary h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{t('addonManager.title')}</h2>
              </div>
            </div>

            {/* Nav Items */}
            <div className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'group h-auto w-full items-start gap-3 px-3 py-2.5 text-left',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t(item.labelKey)}</div>
                      <div
                        className={cn(
                          'mt-0.5 truncate text-xs transition-colors',
                          isActive ? 'text-primary/70' : 'text-muted-foreground/70'
                        )}
                      >
                        {t(item.descKey)}
                      </div>
                    </div>
                    {/* Active indicator */}
                    {isActive && (
                      <div className="bg-primary absolute right-0 h-8 w-0.5 rounded-l-full" />
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Sidebar Footer */}
            <div className="border-border border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenXPlaneFolder}
                className="text-muted-foreground hover:text-foreground w-full justify-start gap-2 text-sm"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t('addonManager.openXPlaneFolder')}
              </Button>
            </div>
          </nav>

          {/* Main Content Area */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Content Header with close button */}
            <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-6">
              <div>
                <h3 className="text-base font-medium">
                  {t(NAV_ITEMS.find((i) => i.id === activeTab)?.labelKey || '')}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'scenery' && <SceneryTab />}
              {activeTab === 'installed' && <BrowserTab />}
              {activeTab === 'installer' && <InstallerTab />}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
