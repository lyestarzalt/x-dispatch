// src/components/dialogs/AddonManager/index.tsx
import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { FolderOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserTab } from './tabs/BrowserTab';
import { InstallerTab } from './tabs/InstallerTab';
import { SceneryTab } from './tabs/SceneryTab';

interface AddonManagerProps {
  open: boolean;
  onClose: () => void;
}

type TabValue = 'scenery' | 'browser' | 'installer';

export function AddonManager({ open, onClose }: AddonManagerProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('scenery');

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
          className="fixed left-[50%] top-[50%] z-50 flex h-[85vh] w-[90vw] max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col rounded-lg border border-border bg-background"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Addon Manager</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header */}
          <div className="flex h-11 shrink-0 items-center justify-between rounded-t-lg border-b border-border bg-card px-4">
            <span className="text-sm font-medium">Addon Manager</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenXPlaneFolder}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open X-Plane Folder
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <TooltipProvider>
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as TabValue)}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <TabsList className="mx-4 mt-4 grid w-fit grid-cols-3">
                <TabsTrigger value="scenery">Scenery Order</TabsTrigger>
                <TabsTrigger value="browser">Browser</TabsTrigger>
                <TabsTrigger value="installer">Installer</TabsTrigger>
              </TabsList>

              <TabsContent value="scenery" className="flex-1 overflow-hidden">
                <SceneryTab />
              </TabsContent>

              <TabsContent value="browser" className="flex-1 overflow-hidden">
                <BrowserTab />
              </TabsContent>

              <TabsContent value="installer" className="flex-1 overflow-hidden">
                <InstallerTab />
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
