// src/components/dialogs/AddonManager/tabs/BrowserTab.tsx
import { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plane, Plug, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AircraftInfo, PluginInfo } from '@/lib/addonManager/core/types';
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

type SubTab = 'aircraft' | 'plugins';

export function BrowserTab() {
  const [subTab, setSubTab] = useState<SubTab>('aircraft');
  const [search, setSearch] = useState('');
  const [liveryDialog, setLiveryDialog] = useState<{
    open: boolean;
    folder: string;
    name: string;
  }>({ open: false, folder: '', name: '' });
  const [scriptsOpen, setScriptsOpen] = useState(false);

  // Aircraft queries - always fetch for tab counts
  const {
    data: aircraft = [],
    isLoading: aircraftLoading,
    error: aircraftError,
  } = useAircraftList();
  const aircraftToggle = useAircraftToggle();
  const aircraftDelete = useAircraftDelete();
  const aircraftLock = useAircraftLock();
  const aircraftCheckUpdates = useAircraftCheckUpdates();

  // Plugin queries - always fetch for tab counts
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
    if (!confirm(`Delete "${ac.displayName}"? This cannot be undone.`)) return;
    await aircraftDelete.mutateAsync(folderName);
  };

  const handleDeletePlugin = async (folderName: string) => {
    const pl = plugins.find((p) => p.folderName === folderName);
    if (!pl) return;
    if (!confirm(`Delete "${pl.displayName}"? This cannot be undone.`)) return;
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

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header with search and stats */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{currentStats.total} total</span>
          <span>{currentStats.enabled} enabled</span>
          {currentStats.updates > 0 && (
            <span className="text-warning">{currentStats.updates} updates</span>
          )}
        </div>

        {/* Check for Updates */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckUpdates}
          disabled={isLoading || checkingUpdates}
        >
          {checkingUpdates ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Check Updates
        </Button>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)} className="flex-1">
        <TabsList className="grid w-fit grid-cols-2">
          <TabsTrigger value="aircraft" className="gap-2">
            <Plane className="h-4 w-4" />
            Aircraft ({aircraft.length})
          </TabsTrigger>
          <TabsTrigger value="plugins" className="gap-2">
            <Plug className="h-4 w-4" />
            Plugins ({plugins.length})
          </TabsTrigger>
        </TabsList>

        {/* Aircraft Tab */}
        <TabsContent value="aircraft" className="mt-4 flex-1">
          {aircraftLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Scanning aircraft...</span>
            </div>
          ) : aircraftError ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {aircraftError instanceof Error ? aircraftError.message : 'Failed to load aircraft'}
              </AlertDescription>
            </Alert>
          ) : filteredAircraft.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search ? 'No aircraft match your search' : 'No aircraft found'}
            </p>
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="grid grid-cols-2 gap-3 pr-4 lg:grid-cols-3">
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

        {/* Plugins Tab */}
        <TabsContent value="plugins" className="mt-4 flex-1">
          {pluginsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Scanning plugins...</span>
            </div>
          ) : pluginsError ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {pluginsError instanceof Error ? pluginsError.message : 'Failed to load plugins'}
              </AlertDescription>
            </Alert>
          ) : filteredPlugins.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search ? 'No plugins match your search' : 'No plugins found'}
            </p>
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="flex flex-col gap-2 pr-4">
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
