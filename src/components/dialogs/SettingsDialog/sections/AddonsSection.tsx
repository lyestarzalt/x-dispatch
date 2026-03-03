import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/stores/settingsStore';

export default function AddonsSection() {
  const { t } = useTranslation();
  const addonManagerEnabled = useSettingsStore((s) => s.addonManagerEnabled);
  const setAddonManagerEnabled = useSettingsStore((s) => s.setAddonManagerEnabled);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('toolbar.addons')}</h3>
        <p className="text-sm text-muted-foreground">
          Manage aircraft, scenery packs and plugins in your X-Plane installation.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="addon-manager-toggle">Enable Addon Manager</Label>
          <p className="text-sm text-muted-foreground">
            Shows the Addons button in the toolbar. Disabled by default as it modifies
            scenery_packs.ini which may affect your scenery load order.
          </p>
        </div>
        <Switch
          id="addon-manager-toggle"
          checked={addonManagerEnabled}
          onCheckedChange={setAddonManagerEnabled}
        />
      </div>
    </div>
  );
}
