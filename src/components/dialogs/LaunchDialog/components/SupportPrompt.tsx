import { ExternalLink, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';

const KOFI_URL = 'https://ko-fi.com/A0A21V3IZZ';
const MIN_LAUNCHES = 2;

function dismiss() {
  useSettingsStore.getState().updateSupportSettings({ promptDismissed: true });
}

/**
 * Show a support toast after the user's 2nd successful launch.
 * Call this from the launch success handler.
 */
export function showSupportToastIfEligible(): void {
  const { promptDismissed } = useSettingsStore.getState().support;
  const { logbook } = useLaunchStore.getState();

  if (promptDismissed || logbook.length < MIN_LAUNCHES) return;

  // Small delay so the launch dialog closes first
  setTimeout(() => {
    toast.custom(
      (id) => (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-card p-4 shadow-lg">
          <Heart className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Enjoying X-Dispatch?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Donations support ongoing development and new features.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  window.open(KOFI_URL, '_blank');
                  dismiss();
                  toast.dismiss(id);
                }}
              >
                Support this project
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => toast.dismiss(id)}
              >
                Not now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground/60"
                onClick={() => {
                  dismiss();
                  toast.dismiss(id);
                }}
              >
                Don't show again
              </Button>
            </div>
          </div>
        </div>
      ),
      { duration: Infinity, position: 'bottom-center' }
    );
  }, 1500);
}
