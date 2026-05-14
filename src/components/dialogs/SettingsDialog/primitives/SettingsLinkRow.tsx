import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openSettingsExternalLink } from '../sections/externalLinks';

interface SettingsLinkRowProps {
  label: React.ReactNode;
  href: string;
  leadingIcon?: React.ReactNode;
}

/**
 * Full-width ghost-button row that opens an external URL via the
 * Electron shell (NOT `window.open`).
 *
 * Pass a `leadingIcon` (already sized — typically `<Heart className="h-3.5 w-3.5 …" />`)
 * if the row needs an extra visual cue. Trailing `<ExternalLink>` is
 * always rendered — never override or remove it.
 */
export function SettingsLinkRow({ label, href, leadingIcon }: SettingsLinkRowProps) {
  return (
    <Button
      variant="ghost"
      onClick={() => void openSettingsExternalLink(href)}
      className="h-auto w-full justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {leadingIcon}
        <span className="truncate">{label}</span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}
