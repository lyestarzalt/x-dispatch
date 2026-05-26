import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  CloudDownload,
  Database,
  Info,
  LifeBuoy,
  Monitor,
  Package,
  Palette,
  Plane,
  ScrollText,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import {
  getSettingsModuleTabs,
  isModuleActive,
  isModuleSettingsTabId,
  moduleSettingsTabId,
} from '@/lib/modules/registry';
import { cn } from '@/lib/utils/helpers';
import { useModulesStore } from '@/stores/modulesStore';
import {
  AboutSection,
  AirportsSection,
  AppearanceSection,
  CompanionAppsSection,
  GraphicsSection,
  LogsSection,
  ModulesSection,
  NavigationDataSection,
  SimbriefSection,
  SupportSection,
  XPlaneSection,
} from './sections';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type CoreTabId =
  | 'xplane'
  | 'data'
  | 'appearance'
  | 'graphics'
  | 'airports'
  | 'simbrief'
  | 'companion-apps'
  | 'modules'
  | 'logs'
  | 'support'
  | 'about';

type SettingsTabId = CoreTabId | `module:${string}`;

interface TabConfig {
  id: SettingsTabId;
  icon: LucideIcon;
  labelKey: string;
}

const CORE_TABS: TabConfig[] = [
  { id: 'xplane', icon: Plane, labelKey: 'settings.tabs.xplane' },
  { id: 'data', icon: Database, labelKey: 'settings.tabs.data' },
  { id: 'appearance', icon: Palette, labelKey: 'settings.tabs.appearance' },
  { id: 'graphics', icon: Monitor, labelKey: 'settings.tabs.graphics' },
  { id: 'airports', icon: Star, labelKey: 'settings.tabs.airports' },
  { id: 'simbrief', icon: CloudDownload, labelKey: 'settings.tabs.simbrief' },
  { id: 'companion-apps', icon: Boxes, labelKey: 'settings.tabs.companionApps' },
  { id: 'modules', icon: Package, labelKey: 'settings.tabs.modules' },
  { id: 'logs', icon: ScrollText, labelKey: 'settings.tabs.logs' },
  { id: 'support', icon: LifeBuoy, labelKey: 'settings.tabs.support' },
  { id: 'about', icon: Info, labelKey: 'settings.tabs.about' },
];

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const modules = useModulesStore((s) => s.modules);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('xplane');

  const settingsModuleTabs = useMemo(() => getSettingsModuleTabs(modules), [modules]);

  const sidebarTabs = useMemo((): TabConfig[] => {
    const activeModuleTabs = settingsModuleTabs.map(
      (tab): TabConfig => ({
        id: moduleSettingsTabId(tab.id) as SettingsTabId,
        icon: tab.icon,
        labelKey: tab.labelKey,
      })
    );

    const modulesIdx = CORE_TABS.findIndex((tab) => tab.id === 'modules');
    const before = CORE_TABS.slice(0, modulesIdx + 1);
    const after = CORE_TABS.slice(modulesIdx + 1);
    return [...before, ...activeModuleTabs, ...after];
  }, [modules]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="h-[85vh] max-w-4xl gap-0 overflow-hidden p-0">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTabId)}
          className="flex h-full"
        >
          <div className="flex w-56 flex-col border-r bg-muted/30">
            <div className="p-4">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">{t('settings.title')}</DialogTitle>
                <DialogDescription className="text-sm">{t('settings.subtitle')}</DialogDescription>
              </DialogHeader>
            </div>

            <Separator />

            <nav className="flex-1 overflow-y-auto p-2">
              <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                {sidebarTabs.map(({ id, icon: Icon, labelKey }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className={cn(
                      'w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium',
                      'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                      'transition-colors hover:bg-background/50',
                      isModuleSettingsTabId(id) && 'pl-6'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </nav>

            <div className="border-t p-4">
              <p className="font-mono text-sm text-muted-foreground">{version && `v${version}`}</p>
            </div>
          </div>

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
              value="graphics"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Graphics">
                  <GraphicsSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="airports"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Airports">
                  <AirportsSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="simbrief"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="SimBrief">
                  <SimbriefSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="companion-apps"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Companion Apps">
                  <CompanionAppsSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="modules"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Modules">
                  <ModulesSection />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            {settingsModuleTabs.map((tab) => (
              <TabsContent
                key={tab.id}
                value={moduleSettingsTabId(tab.id)}
                className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
              >
                <div className="p-6">
                  <SectionErrorBoundary name={tab.labelKey}>
                    {isModuleActive(modules, tab.moduleId) ? tab.render() : null}
                  </SectionErrorBoundary>
                </div>
              </TabsContent>
            ))}

            <TabsContent
              value="logs"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Logs">
                  <LogsSection active={activeTab === 'logs'} />
                </SectionErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent
              value="support"
              className="absolute inset-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="p-6">
                <SectionErrorBoundary name="Support">
                  <SupportSection />
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
