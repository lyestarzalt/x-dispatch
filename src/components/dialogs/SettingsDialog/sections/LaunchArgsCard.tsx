import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { XPLANE_ARG_CATALOG } from '@/config/xplaneArgs';
import { cn } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';

export default function LaunchArgsCard() {
  const { t } = useTranslation();
  const customLaunchArgs = useSettingsStore((s) => s.launcher.customLaunchArgs);
  const updateLauncherSettings = useSettingsStore((s) => s.updateLauncherSettings);
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const addArg = (arg: string) => {
    const trimmed = arg.trim();
    if (!trimmed || customLaunchArgs.includes(trimmed)) return;
    updateLauncherSettings({ customLaunchArgs: [...customLaunchArgs, trimmed] });
  };

  const removeArg = (arg: string) => {
    updateLauncherSettings({ customLaunchArgs: customLaunchArgs.filter((a) => a !== arg) });
  };

  const handleCatalogSelect = (catalogArg: string) => {
    if (catalogArg.endsWith('=') || catalogArg.endsWith(':')) {
      setCustomInput(catalogArg);
      setOpen(false);
      return;
    }
    addArg(catalogArg);
    setOpen(false);
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      addArg(customInput);
      setCustomInput('');
    }
  };

  const categories = [...new Set(XPLANE_ARG_CATALOG.map((a) => a.category))];

  const isArgAdded = (catalogArg: string) => {
    if (catalogArg.endsWith('=') || catalogArg.endsWith(':')) {
      return customLaunchArgs.some((a) => a.startsWith(catalogArg));
    }
    return customLaunchArgs.includes(catalogArg);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t('settings.xplane.launchArgs')}</p>
        <p className="text-xs text-muted-foreground">
          {t('settings.xplane.launchArgsDescription')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 text-xs">
              {t('settings.xplane.launchArgsBrowse')}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandInput placeholder={t('settings.xplane.launchArgsSearch')} className="h-8" />
              <CommandList>
                <CommandEmpty>{t('settings.xplane.launchArgsNoResults')}</CommandEmpty>
                {categories.map((category) => (
                  <CommandGroup key={category} heading={category}>
                    {XPLANE_ARG_CATALOG.filter((a) => a.category === category).map((item) => (
                      <CommandItem
                        key={item.arg}
                        value={`${item.arg} ${item.description}`}
                        onSelect={() => handleCatalogSelect(item.arg)}
                        disabled={isArgAdded(item.arg)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-3.5 w-3.5',
                            isArgAdded(item.arg) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-xs">{item.arg}</span>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
            placeholder={t('settings.xplane.launchArgsPlaceholder')}
            className="h-8 min-w-0 flex-1 font-mono text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {customLaunchArgs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-success">
            {t('settings.xplane.launchArgsActive', { count: customLaunchArgs.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {customLaunchArgs.map((arg) => (
              <Badge key={arg} variant="default" className="gap-1 font-mono text-xs">
                {arg}
                <button
                  type="button"
                  onClick={() => removeArg(arg)}
                  className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
