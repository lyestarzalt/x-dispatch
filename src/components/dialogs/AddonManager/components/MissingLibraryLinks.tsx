// src/components/dialogs/AddonManager/components/MissingLibraryLinks.tsx
// The libraries a scenery pack needs, each with a way to go and get it.
import { useTranslation } from 'react-i18next';
import { ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { libraryLink } from '@/lib/addonManager/scenery/libraryLinks';

interface MissingLibraryLinksProps {
  libraries: string[];
  /** Without the heading, for use under a warning that already says what this is. */
  compact?: boolean;
}

export function MissingLibraryLinks({ libraries, compact }: MissingLibraryLinksProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {!compact && (
        <p className="xp-section-heading mb-2">
          {t('addonManager.sceneryEntry.missingLibrariesTitle')}
        </p>
      )}
      {libraries.map((library) => {
        const link = libraryLink(library);
        const Icon = link.known ? ExternalLink : Search;
        return (
          <Button
            key={library}
            variant="ghost"
            className="hover:bg-secondary h-auto w-full justify-between gap-3 px-2 py-1.5 text-sm"
            title={
              link.known
                ? t('addonManager.sceneryEntry.openDownload')
                : t('addonManager.sceneryEntry.searchDownload')
            }
            onClick={() => void window.appAPI.openExternal(link.url)}
          >
            <span className="min-w-0 truncate font-mono text-xs">{library}</span>
            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
              {link.known && <span className="truncate">{link.name}</span>}
              <Icon className="h-3.5 w-3.5" />
            </span>
          </Button>
        );
      })}
    </div>
  );
}
