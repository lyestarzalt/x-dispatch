// src/components/dialogs/AddonManager/tabs/BrowserTab.tsx
// Shows installed addons - Aircraft and Plugins with tabs (Plugins first)
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Plane, Plug, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAircraftDelete,
  useAircraftList,
  useAircraftLock,
  useAircraftToggle,
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
    refetch: refetchAircraft,
    isFetching: aircraftFetching,
  } = useAircraftList();
  const aircraftToggle = useAircraftToggle();
  const aircraftDelete = useAircraftDelete();
  const aircraftLock = useAircraftLock();

  // Plugin queries
  const {
    data: plugins = [],
    isLoading: pluginsLoading,
    error: pluginsError,
    refetch: refetchPlugins,
    isFetching: pluginsFetching,
  } = usePluginList();
  const pluginToggle = usePluginToggle();
  const pluginDelete = usePluginDelete();
  const pluginLock = usePluginLock();

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

  const isAircraftPending =
    aircraftToggle.isPending || aircraftDelete.isPending || aircraftLock.isPending;
  const isPluginPending = pluginToggle.isPending || pluginDelete.isPending || pluginLock.isPending;

  const totalAddons = aircraft.length + plugins.length;
  const totalEnabled = aircraftStats.enabled + pluginStats.enabled;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — matches SceneryTab layout */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        {/* Left: stats + updates badge */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{totalAddons}</span>
            {' addons · '}
            <span className="text-success">{totalEnabled}</span>
            {' on · '}
            <span>{totalAddons - totalEnabled}</span>
            {' off'}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          <Input
            placeholder={t('addonManager.installed.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-sm"
            startIcon={<Search />}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const beforeAc = aircraft.length;
              const beforePl = plugins.length;
              const [acResult, plResult] = await Promise.all([refetchAircraft(), refetchPlugins()]);
              const afterAc = acResult.data?.length ?? beforeAc;
              const afterPl = plResult.data?.length ?? beforePl;
              const diff = afterAc + afterPl - beforeAc - beforePl;
              if (diff > 0) {
                toast.success(t('addonManager.rescanFound', { count: diff }));
              } else if (diff < 0) {
                toast.success(t('addonManager.rescanRemoved', { count: Math.abs(diff) }));
              } else {
                toast(t('addonManager.rescanNoChanges'), { icon: <Check className="h-4 w-4" /> });
              }
            }}
            disabled={aircraftFetching || pluginsFetching}
            className="gap-1.5 text-muted-foreground"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${aircraftFetching || pluginsFetching ? 'animate-spin' : ''}`}
            />
            {t('addonManager.rescan')}
          </Button>
        </div>
      </div>

      {/* Tabs - Plugins first */}
      <Tabs
        value={subTab}
        onValueChange={(v) => setSubTab(v as SubTab)}
        className="flex min-h-0 flex-1 flex-col"
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
        <TabsContent
          value="plugins"
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
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
            <ScrollArea className="h-full">
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
        <TabsContent
          value="aircraft"
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
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
            <ScrollArea className="h-full">
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
