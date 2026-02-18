import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Info, Palette, Plane, Radar } from 'lucide-react';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppVersion } from '@/hooks/useAppVersion';
import { cn } from '@/lib/utils/helpers';
import {
  AboutSection,
  AppearanceSection,
  NavigationDataSection,
  VatsimSection,
  XPlaneSection,
} from './sections';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  isVatsimEnabled?: boolean;
  onToggleVatsim?: () => void;
  vatsimPilotCount?: number;
}

type TabId = 'xplane' | 'data' | 'appearance' | 'vatsim' | 'about';

interface TabConfig {
  id: TabId;
  icon: typeof Plane;
  labelKey: string;
}

const TABS: TabConfig[] = [
  { id: 'xplane', icon: Plane, labelKey: 'settings.tabs.xplane' },
  { id: 'data', icon: Database, labelKey: 'settings.tabs.data' },
  { id: 'appearance', icon: Palette, labelKey: 'settings.tabs.appearance' },
  { id: 'vatsim', icon: Radar, labelKey: 'settings.tabs.vatsim' },
  { id: 'about', icon: Info, labelKey: 'settings.tabs.about' },
];

export default function SettingsDialog({
  open,
  onClose,
  isVatsimEnabled = false,
  onToggleVatsim,
  vatsimPilotCount,
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const [activeTab, setActiveTab] = useState<TabId>('xplane');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="h-[85vh] max-w-4xl gap-0 overflow-hidden p-0">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
          className="flex h-full"
        >
          {/* Sidebar Navigation */}
          <div className="flex w-56 flex-col border-r bg-muted/30">
            <div className="p-4">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">{t('settings.title')}</DialogTitle>
                <DialogDescription className="text-xs">{t('settings.subtitle')}</DialogDescription>
              </DialogHeader>
            </div>

            <Separator />

            <nav className="flex-1 p-2">
              <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                {TABS.map(({ id, icon: Icon, labelKey }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className={cn(
                      'w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium',
                      'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                      'transition-colors hover:bg-background/50',
                      id === 'vatsim' && isVatsimEnabled && 'text-success'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        id === 'vatsim' && isVatsimEnabled && 'text-success'
                      )}
                    />
                    {t(labelKey)}
                    {id === 'vatsim' && isVatsimEnabled && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-success" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </nav>

            {/* Version Footer */}
            <div className="border-t p-4">
              <p className="font-mono text-xs text-muted-foreground">{version && `v${version}`}</p>
            </div>
          </div>

          {/* Content Area */}
          <div className="relative min-h-0 flex-1">
            <TabsContent
              value="xplane"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="X-Plane Settings">
                  <XPlaneSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="data"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Navigation Data">
                  <NavigationDataSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="appearance"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Appearance">
                  <AppearanceSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="vatsim"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="VATSIM">
                  <VatsimSection
                    isVatsimEnabled={isVatsimEnabled}
                    onToggleVatsim={onToggleVatsim || (() => {})}
                    vatsimPilotCount={vatsimPilotCount}
                  />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="about"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="About">
                  <AboutSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
