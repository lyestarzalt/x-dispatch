import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Compass,
  Database,
  FolderOpen,
  Globe,
  Loader2,
  Map,
  Monitor,
  Moon,
  Plane,
  Radar,
  Sun,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppVersion } from '@/hooks/useAppVersion';
import { changeLanguage, languages } from '@/i18n';
import { MAP_STYLE_PRESETS, MapSettings, useSettingsStore } from '@/stores/settingsStore';
import { useThemeStore } from '@/stores/themeStore';

interface SettingsPageProps {
  open: boolean;
  onClose: () => void;
  isVatsimEnabled?: boolean;
  onToggleVatsim?: () => void;
  vatsimPilotCount?: number;
}

export default function SettingsPage({
  open,
  onClose,
  isVatsimEnabled = false,
  onToggleVatsim,
  vatsimPilotCount,
}: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const version = useAppVersion();
  const { map: mapSettings, updateMapSettings } = useSettingsStore();
  const { theme, setTheme } = useThemeStore();

  const [xplanePath, setXplanePath] = useState<string | null>(null);
  const [detectedPaths, setDetectedPaths] = useState<string[]>([]);
  const [pathLoading, setPathLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('xplane');
  const [dataStatus, setDataStatus] = useState<{
    airports: { count: number; source: string | null };
    navaids: { count: number; source: string | null };
    waypoints: { count: number; source: string | null };
    airspaces: { count: number; source: string | null };
    airways: { count: number; source: string | null };
  } | null>(null);

  useEffect(() => {
    if (open) {
      loadPath();
      loadDataStatus();
    }
  }, [open]);

  async function loadDataStatus() {
    try {
      const result = await window.appAPI.getLoadingStatus();
      setDataStatus(result.status);
    } catch {
      // Ignore errors
    }
  }

  async function loadPath() {
    try {
      const path = await window.xplaneAPI.getPath();
      setXplanePath(path);
      const detected = await window.xplaneAPI.detectInstallations();
      setDetectedPaths([...new Set(detected)]);
    } catch {
      // Ignore errors
    }
  }

  const handleBrowse = async () => {
    setPathLoading(true);
    try {
      const result = await window.xplaneAPI.browseForPath();
      if (result?.valid) {
        setXplanePath(result.path);
        await window.xplaneAPI.setPath(result.path);
      }
    } catch {
      // ignore
    } finally {
      setPathLoading(false);
    }
  };

  const handleSelectPath = async (path: string) => {
    setPathLoading(true);
    try {
      const validation = await window.xplaneAPI.validatePath(path);
      if (validation.valid) {
        await window.xplaneAPI.setPath(path);
        setXplanePath(path);
      }
    } catch {
      // ignore
    } finally {
      setPathLoading(false);
    }
  };

  const handleChange = useCallback(
    <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => {
      updateMapSettings({ [key]: value });
    },
    [updateMapSettings]
  );

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full">
          {/* Sidebar */}
          <div className="flex w-48 flex-col border-r bg-muted/30 p-4">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-base font-medium">{t('settings.title')}</DialogTitle>
              <DialogDescription className="text-xs">{t('settings.subtitle')}</DialogDescription>
            </DialogHeader>

            <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent">
              <TabsTrigger
                value="xplane"
                className="w-full justify-start gap-2 px-3 data-[state=active]:bg-background"
              >
                <Plane className="h-4 w-4" />
                {t('settings.tabs.xplane')}
              </TabsTrigger>
              <TabsTrigger
                value="appearance"
                className="w-full justify-start gap-2 px-3 data-[state=active]:bg-background"
              >
                <Sun className="h-4 w-4" />
                {t('settings.tabs.appearance')}
              </TabsTrigger>
              <TabsTrigger
                value="navigation"
                className="w-full justify-start gap-2 px-3 data-[state=active]:bg-background"
              >
                <Compass className="h-4 w-4" />
                {t('settings.tabs.navigation')}
              </TabsTrigger>
            </TabsList>

            <div className="mt-auto pt-4">
              <p className="font-mono text-[10px] text-muted-foreground">
                {version && `v${version}`}
              </p>
            </div>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* X-Plane Tab */}
              <TabsContent value="xplane" className="mt-0 space-y-6">
                <div>
                  <h3 className="text-lg font-medium">{t('settings.xplane.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.xplane.description')}
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.xplane.currentPath')}</Label>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
                      {xplanePath ? (
                        <>
                          <Check className="h-4 w-4 shrink-0 text-green-500" />
                          <span className="truncate font-mono text-sm">{xplanePath}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t('common.notConfigured')}
                        </span>
                      )}
                    </div>
                  </div>

                  {detectedPaths.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('settings.xplane.detectedInstallations')}</Label>
                      <div className="space-y-2">
                        {detectedPaths.map((path) => (
                          <Button
                            key={path}
                            variant={path === xplanePath ? 'secondary' : 'outline'}
                            className="h-auto w-full justify-start gap-3 py-3 font-mono text-sm"
                            disabled={pathLoading || path === xplanePath}
                            onClick={() => handleSelectPath(path)}
                          >
                            <div
                              className={`h-2 w-2 rounded-full ${
                                path === xplanePath ? 'bg-primary' : 'bg-muted-foreground/30'
                              }`}
                            />
                            <span className="flex-1 truncate text-left">{path}</span>
                            {path === xplanePath && (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleBrowse}
                    disabled={pathLoading}
                    className="gap-2"
                  >
                    {pathLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="h-4 w-4" />
                    )}
                    {t('setup.browseManually')}
                  </Button>
                </div>

                {/* Data Overview */}
                {dataStatus && xplanePath && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <Label>{t('settings.xplane.dataLoaded')}</Label>
                      </div>
                      <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">
                                {t('settings.xplane.dataType')}
                              </th>
                              <th className="px-4 py-2 text-right font-medium">
                                {t('settings.xplane.count')}
                              </th>
                              <th className="px-4 py-2 text-left font-medium">
                                {t('settings.xplane.source')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="px-4 py-2">{t('loading.steps.airports')}</td>
                              <td className="px-4 py-2 text-right font-mono">
                                {dataStatus.airports.count.toLocaleString()}
                              </td>
                              <td
                                className="px-4 py-2 font-mono text-xs text-muted-foreground"
                                title={dataStatus.airports.source || ''}
                              >
                                <span className="block max-w-[250px] truncate">
                                  {dataStatus.airports.source || '-'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2">{t('loading.steps.navaids')}</td>
                              <td className="px-4 py-2 text-right font-mono">
                                {dataStatus.navaids.count.toLocaleString()}
                              </td>
                              <td
                                className="px-4 py-2 font-mono text-xs text-muted-foreground"
                                title={dataStatus.navaids.source || ''}
                              >
                                <span className="block max-w-[250px] truncate">
                                  {dataStatus.navaids.source || '-'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2">{t('loading.steps.waypoints')}</td>
                              <td className="px-4 py-2 text-right font-mono">
                                {dataStatus.waypoints.count.toLocaleString()}
                              </td>
                              <td
                                className="px-4 py-2 font-mono text-xs text-muted-foreground"
                                title={dataStatus.waypoints.source || ''}
                              >
                                <span className="block max-w-[250px] truncate">
                                  {dataStatus.waypoints.source || '-'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2">{t('loading.steps.airspaces')}</td>
                              <td className="px-4 py-2 text-right font-mono">
                                {dataStatus.airspaces.count.toLocaleString()}
                              </td>
                              <td
                                className="px-4 py-2 font-mono text-xs text-muted-foreground"
                                title={dataStatus.airspaces.source || ''}
                              >
                                <span className="block max-w-[250px] truncate">
                                  {dataStatus.airspaces.source || '-'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2">{t('loading.steps.airways')}</td>
                              <td className="px-4 py-2 text-right font-mono">
                                {dataStatus.airways.count.toLocaleString()}
                              </td>
                              <td
                                className="px-4 py-2 font-mono text-xs text-muted-foreground"
                                title={dataStatus.airways.source || ''}
                              >
                                <span className="block max-w-[250px] truncate">
                                  {dataStatus.airways.source || '-'}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance" className="mt-0 space-y-6">
                <div>
                  <h3 className="text-lg font-medium">{t('settings.appearance.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.appearance.description')}
                  </p>
                </div>

                <Separator />

                <div className="space-y-6">
                  {/* Theme */}
                  <div className="space-y-4">
                    <Label>{t('settings.appearance.theme')}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', labelKey: 'settings.appearance.light', icon: Sun },
                        { id: 'dark', labelKey: 'settings.appearance.dark', icon: Moon },
                        { id: 'system', labelKey: 'settings.appearance.system', icon: Monitor },
                      ].map(({ id, labelKey, icon: Icon }) => (
                        <Button
                          key={id}
                          variant={theme === id ? 'secondary' : 'outline'}
                          className="h-auto flex-col gap-2 py-4"
                          onClick={() => setTheme(id as 'light' | 'dark' | 'system')}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs">{t(labelKey)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Map Style */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Map className="h-4 w-4 text-muted-foreground" />
                      <Label>{t('settings.appearance.mapStyle')}</Label>
                    </div>

                    {/* OpenFreeMap */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">OpenFreeMap</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          {t('settings.appearance.unlimited')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {MAP_STYLE_PRESETS.filter((p) => p.provider === 'openfreemap').map(
                          (preset) => (
                            <Button
                              key={preset.id}
                              variant={
                                mapSettings.mapStyleUrl === preset.url ? 'secondary' : 'outline'
                              }
                              size="sm"
                              onClick={() => handleChange('mapStyleUrl', preset.url)}
                            >
                              {preset.name}
                            </Button>
                          )
                        )}
                      </div>
                    </div>

                    {/* CARTO */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">CARTO</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {MAP_STYLE_PRESETS.filter((p) => p.provider === 'carto').map((preset) => (
                          <Button
                            key={preset.id}
                            variant={
                              mapSettings.mapStyleUrl === preset.url ? 'secondary' : 'outline'
                            }
                            size="sm"
                            onClick={() => handleChange('mapStyleUrl', preset.url)}
                          >
                            {preset.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Custom URL */}
                    <div className="space-y-2 border-t pt-2">
                      <Label className="text-xs">{t('settings.appearance.customStyleUrl')}</Label>
                      <Input
                        type="url"
                        placeholder="https://example.com/style.json"
                        value={mapSettings.mapStyleUrl}
                        onChange={(e) => handleChange('mapStyleUrl', e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {t('settings.appearance.customStyleHint')}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Language */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <Label>{t('settings.appearance.language')}</Label>
                    </div>
                    <Select value={i18n.language} onValueChange={handleLanguageChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Navigation Tab */}
              <TabsContent value="navigation" className="mt-0 space-y-6">
                <div>
                  <h3 className="text-lg font-medium">{t('settings.navigation.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.navigation.description')}
                  </p>
                </div>

                <Separator />

                <div className="space-y-6">
                  {/* Search Radius */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('settings.navigation.searchRadius')}</Label>
                      <span className="font-mono text-sm text-muted-foreground">
                        {mapSettings.navDataRadiusNm} {t('units.nm')}
                      </span>
                    </div>
                    <Slider
                      value={[mapSettings.navDataRadiusNm]}
                      onValueChange={([v]) => handleChange('navDataRadiusNm', v)}
                      min={50}
                      max={200}
                      step={25}
                    />
                  </div>

                  <Separator />

                  {/* VATSIM Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Radar className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium">{t('settings.navigation.vatsim.title')}</h4>
                    </div>

                    {/* VATSIM Toggle */}
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                      <div className="space-y-1">
                        <Label htmlFor="vatsim-toggle" className="cursor-pointer">
                          {t('settings.navigation.vatsim.enable')}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t('settings.navigation.vatsim.description')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isVatsimEnabled && vatsimPilotCount !== undefined && (
                          <Badge
                            variant="secondary"
                            className="border-0 bg-green-500/20 text-green-400"
                          >
                            {vatsimPilotCount.toLocaleString()} {t('common.online')}
                          </Badge>
                        )}
                        <Switch
                          id="vatsim-toggle"
                          checked={isVatsimEnabled}
                          onCheckedChange={() => onToggleVatsim?.()}
                        />
                      </div>
                    </div>

                    {/* VATSIM Refresh - only show when enabled */}
                    {isVatsimEnabled && (
                      <div className="space-y-3 border-l-2 border-green-500/30 pl-4">
                        <div className="flex items-center justify-between">
                          <Label>{t('settings.navigation.vatsim.refreshInterval')}</Label>
                          <span className="font-mono text-sm text-muted-foreground">
                            {mapSettings.vatsimRefreshInterval}
                            {t('units.s')}
                          </span>
                        </div>
                        <Slider
                          value={[mapSettings.vatsimRefreshInterval]}
                          onValueChange={([v]) => handleChange('vatsimRefreshInterval', v)}
                          min={10}
                          max={60}
                          step={5}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('settings.navigation.vatsim.refreshHelp')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
