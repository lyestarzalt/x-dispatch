import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  type AppMenuNode,
  formatAccelerator,
  listShortcuts,
} from '@/lib/nativeShell/menuSerialization';
import { useAppStore } from '@/stores/appStore';

/** Shortcuts handled in the page rather than by a menu item. */
const IN_APP_SHORTCUTS = [
  { labelKey: 'shortcuts.inApp.debugPanels', accelerator: 'CmdOrCtrl+Shift+D' },
  { labelKey: 'shortcuts.inApp.closeDialog', accelerator: 'Escape' },
] as const;

function Keys({ accelerator }: { accelerator: string }) {
  const parts = formatAccelerator(accelerator, window.appAPI.platform);
  return (
    <KbdGroup>
      {parts.map((part, i) => (
        <Kbd key={`${part}-${i}`}>{part}</Kbd>
      ))}
    </KbdGroup>
  );
}

/**
 * Every shortcut, read from the native menu so the list can never drift from
 * what the keys actually do, plus the few handled in the page.
 */
export function KeyboardShortcutsDialog() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.showShortcuts);
  const setShowShortcuts = useAppStore((s) => s.setShowShortcuts);
  const [menu, setMenu] = useState<AppMenuNode[]>([]);

  useEffect(() => {
    if (!open || window.appAPI.isRemoteClient) return;
    void window.appAPI.getAppMenu().then(setMenu);
  }, [open]);

  const groups = listShortcuts(menu);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && setShowShortcuts(false)}>
      <DialogContent className="max-h-[calc(100vh-3rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.group} className="space-y-2">
              <h3 className="xp-section-heading">{group.group}</h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={`${group.group}-${item.label}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    <Keys accelerator={item.accelerator} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="space-y-2">
            <h3 className="xp-section-heading">{t('shortcuts.inApp.title')}</h3>
            <ul className="space-y-1.5">
              {IN_APP_SHORTCUTS.map((item) => (
                <li key={item.labelKey} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                  <Keys accelerator={item.accelerator} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
