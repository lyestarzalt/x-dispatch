// src/components/dialogs/AddonManager/tabs/BrowserTab.tsx
// Shows installed addons - Aircraft and Plugins with tabs (Plugins first)
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Plane, Plug, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAircraftCheckUpdates,
  useAircraftDelete,
  useAircraftList,
  useAircraftLock,
  useAircraftToggle,
  usePluginCheckUpdates,
  usePluginDelete,
  usePluginList,
  usePluginLock,
  usePluginToggle,
} from '@/queries/useAddonManager';
import { AircraftCard } from '../components/AircraftCard';
import { LiveryDialog } from '../components/LiveryDialog';
import { PluginEntry } from '../components/PluginEntry';
import { ScriptsDialog } from '../components/ScriptsDialog';

type SubTab = 'plugins' | 'aircraft';

export function BrowserTab() {
  const { t } = useTranslation();
  // Default to plugins tab
  const [subTab, setSubTab] = useState<SubTab>('plugins');
  const [search, setSearch] = useState('');
  const [liveryDialog, setLiveryDialog] = useState<{
    open: boolean;
    folder: string;
    name: string;
  }>({ open: false, folder: '', name: '' });
  const [scriptsOpen, setScriptsOpen] = useState(false);

  // Aircraft queries
  const {
    data: aircraft = [],
    isLoading: aircraftLoading,
    error: aircraftError,
  } = useAircraftList();
  const aircraftToggle = useAircraftToggle();
  const aircraftDelete = useAircraftDelete();
  const aircraftLock = useAircraftLock();
  const aircraftCheckUpdates = useAircraftCheckUpdates();

  // Plugin queries
  const { data: plugins = [], isLoading: pluginsLoading, error: pluginsError } = usePluginList();
  const pluginToggle = usePluginToggle();
  const pluginDelete = usePluginDelete();
  const pluginLock = usePluginLock();
  const pluginCheckUpdates = usePluginCheckUpdates();

  // Filter by search
  const filteredAircraft = useMemo(() => {
    if (!search.trim()) return aircraft;
    const lower = search.toLowerCase();
    return aircraft.filter(
      (a) =>
        a.displayName.toLowerCase().includes(lower) || a.folderName.toLowerCase().includes(lower)
    );
  }, [aircraft, search]);

  const filteredPlugins = useMemo(() => {
    if (!search.trim()) return plugins;
    const lower = search.toLowerCase();
    return plugins.filter(
      (p) =>
        p.displayName.toLowerCase().includes(lower) || p.folderName.toLowerCase().includes(lower)
    );
  }, [plugins, search]);

  // Statistics
  const aircraftStats = useMemo(() => {
    const total = aircraft.length;
    const enabled = aircraft.filter((a) => a.enabled).length;
    const updates = aircraft.filter((a) => a.hasUpdate).length;
    return { total, enabled, updates };
  }, [aircraft]);

  const pluginStats = useMemo(() => {
    const total = plugins.length;
    const enabled = plugins.filter((p) => p.enabled).length;
    const updates = plugins.filter((p) => p.hasUpdate).length;
    return { total, enabled, updates };
  }, [plugins]);

  const handleOpenFolder = async (relativePath: string, type: 'aircraft' | 'plugins') => {
    const xplanePath = await window.xplaneAPI.getPath();
    if (!xplanePath) return;

    const fullPath =
      type === 'aircraft'
        ? `${xplanePath}/Aircraft/${relativePath}`
        : `${xplanePath}/Resources/plugins/${relativePath}`;
    window.appAPI.openPath(fullPath);
  };

  const handleDeleteAircraft = async (folderName: string) => {
    const ac = aircraft.find((a) => a.folderName === folderName);
    if (!ac) return;
    if (!confirm(t('addonManager.browser.confirmDelete', { name: ac.displayName }))) return;
    await aircraftDelete.mutateAsync(folderName);
  };

  const handleDeletePlugin = async (folderName: string) => {
    const pl = plugins.find((p) => p.folderName === folderName);
    if (!pl) return;
    if (!confirm(t('addonManager.browser.confirmDelete', { name: pl.displayName }))) return;
    await pluginDelete.mutateAsync(folderName);
  };

  const handleCheckUpdates = () => {
    if (subTab === 'aircraft') {
      aircraftCheckUpdates.mutate(aircraft);
    } else {
      pluginCheckUpdates.mutate(plugins);
    }
  };

  const isAircraftPending =
    aircraftToggle.isPending || aircraftDelete.isPending || aircraftLock.isPending;
  const isPluginPending = pluginToggle.isPending || pluginDelete.isPending || pluginLock.isPending;
  const checkingUpdates =
    subTab === 'aircraft' ? aircraftCheckUpdates.isPending : pluginCheckUpdates.isPending;

  const currentStats = subTab === 'aircraft' ? aircraftStats : pluginStats;
  const isLoading = subTab === 'aircraft' ? aircraftLoading : pluginsLoading;

  const totalAddons = aircraft.length + plugins.length;
  const totalEnabled = aircraftStats.enabled + pluginStats.enabled;
  const totalUpdates = aircraftStats.updates + pluginStats.updates;

  return (
    <div className="flex h-full flex-col">
      {/* Stats Bar */}
      <div className="flex items-center justify-between border-b border-border bg-card/30 px-4 py-3">
        <div className="flex items-center gap-6">
          {/* Total count */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">{totalAddons}</span>
            <span className="text-sm text-muted-foreground">
              {t('addonManager.installed.total')}
            </span>
          </div>

          {/* Enabled/Disabled */}
          <div className="flex items-center gap-4 border-l border-border pl-6">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm tabular-nums text-muted-foreground">{totalEnabled}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-sm tabular-nums text-muted-foreground">
                {totalAddons - totalEnabled}
              </span>
            </div>
          </div>

          {/* Updates badge */}
          {totalUpdates > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1">
              <RefreshCw className="h-3 w-3 text-warning" />
              <span className="text-xs font-medium text-warning">
                {t('addonManager.installed.updatesAvailable', { count: totalUpdates })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <Input
            placeholder={t('addonManager.installed.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-sm"
            startIcon={<Search />}
          />

          {/* Check Updates */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckUpdates}
            disabled={isLoading || checkingUpdates}
            className="gap-2"
          >
            {checkingUpdates ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            {t('addonManager.installed.checkUpdates')}
          </Button>
        </div>
      </div>

      {/* Tabs - Plugins first */}
      <Tabs
        value={subTab}
        onValueChange={(v) => setSubTab(v as SubTab)}
        className="flex flex-1 flex-col"
      >
        <div className="px-4">
          <TabsList variant="line">
            {/* Plugins tab first */}
            <TabsTrigger
              value="plugins"
              className="gap-2 px-4 py-3 data-[state=active]:border-violet data-[state=active]:text-violet"
            >
              <Plug className="h-4 w-4" />
              <span>{t('addonManager.installed.plugins')}</span>
              <Badge
                variant="violet"
                className="ml-1 rounded-full px-2 py-0.5 text-xs tabular-nums"
              >
                {plugins.length}
              </Badge>
              {pluginStats.updates > 0 && (
                <Badge
                  variant="warning"
                  className="rounded-full px-1.5 py-0.5 text-xs tabular-nums"
                >
                  {pluginStats.updates}
                </Badge>
              )}
            </TabsTrigger>
            {/* Aircraft tab second */}
            <TabsTrigger
              value="aircraft"
              className="gap-2 px-4 py-3 data-[state=active]:border-cat-sky data-[state=active]:text-cat-sky"
            >
              <Plane className="h-4 w-4" />
              <span>{t('addonManager.installed.aircraft')}</span>
              <Badge
                variant="cat-sky"
                className="ml-1 rounded-full px-2 py-0.5 text-xs tabular-nums"
              >
                {aircraft.length}
              </Badge>
              {aircraftStats.updates > 0 && (
                <Badge
                  variant="warning"
                  className="rounded-full px-1.5 py-0.5 text-xs tabular-nums"
                >
                  {aircraftStats.updates}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Plugins Tab Content */}
        <TabsContent value="plugins" className="mt-0 flex-1 data-[state=inactive]:hidden">
          {pluginsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Spinner className="size-8 text-violet" />
              <span className="text-sm text-muted-foreground">
                {t('addonManager.installed.scanningPlugins')}
              </span>
            </div>
          ) : pluginsError ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {pluginsError instanceof Error
                  ? pluginsError.message
                  : t('addonManager.installed.loadFailed', { type: 'plugins' })}
              </AlertDescription>
            </Alert>
          ) : filteredPlugins.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search
                ? t('addonManager.installed.noMatch', { type: 'plugins' })
                : t('addonManager.installed.notFound', { type: 'plugins' })}
            </p>
          ) : (
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="flex flex-col gap-2 p-4">
                {filteredPlugins.map((plugin) => (
                  <PluginEntry
                    key={plugin.folderName}
                    plugin={plugin}
                    onToggle={(name) => pluginToggle.mutate(name)}
                    onDelete={handleDeletePlugin}
                    onLock={(name) => pluginLock.mutate(name)}
                    onOpenFolder={(name) => handleOpenFolder(name, 'plugins')}
                    onOpenScripts={
                      plugin.folderName.toLowerCase() === 'flywithlua'
                        ? () => setScriptsOpen(true)
                        : undefined
                    }
                    disabled={isPluginPending}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Aircraft Tab Content */}
        <TabsContent value="aircraft" className="mt-0 flex-1 data-[state=inactive]:hidden">
          {aircraftLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Spinner className="size-8 text-cat-sky" />
              <span className="text-sm text-muted-foreground">
                {t('addonManager.installed.scanningAircraft')}
              </span>
            </div>
          ) : aircraftError ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {aircraftError instanceof Error
                  ? aircraftError.message
                  : t('addonManager.installed.loadFailed', { type: 'aircraft' })}
              </AlertDescription>
            </Alert>
          ) : filteredAircraft.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search
                ? t('addonManager.installed.noMatch', { type: 'aircraft' })
                : t('addonManager.installed.notFound', { type: 'aircraft' })}
            </p>
          ) : (
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3">
                {filteredAircraft.map((ac) => (
                  <AircraftCard
                    key={ac.folderName}
                    aircraft={ac}
                    onToggle={(name) => aircraftToggle.mutate(name)}
                    onDelete={handleDeleteAircraft}
                    onLock={(name) => aircraftLock.mutate(name)}
                    onOpenFolder={(name) => handleOpenFolder(name, 'aircraft')}
                    onOpenLiveries={(name) =>
                      setLiveryDialog({
                        open: true,
                        folder: name,
                        name: ac.displayName,
                      })
                    }
                    disabled={isAircraftPending}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Livery Dialog */}
      <LiveryDialog
        open={liveryDialog.open}
        onClose={() => setLiveryDialog({ open: false, folder: '', name: '' })}
        aircraftFolder={liveryDialog.folder}
        aircraftName={liveryDialog.name}
      />

      {/* Scripts Dialog */}
      <ScriptsDialog open={scriptsOpen} onClose={() => setScriptsOpen(false)} />
    </div>
  );
}
