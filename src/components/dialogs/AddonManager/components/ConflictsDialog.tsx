// src/components/dialogs/AddonManager/components/ConflictsDialog.tsx
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ExternalLink, Layers, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import type { SceneryConflicts } from '@/lib/addonManager/scenery/conflicts';

interface ConflictsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts?: SceneryConflicts;
  isLoading: boolean;
}

function packName(sceneryPath: string): string {
  const parts = sceneryPath.split('/');
  return parts[parts.length - 1] || sceneryPath;
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

export function ConflictsDialog({
  open,
  onOpenChange,
  conflicts,
  isLoading,
}: ConflictsDialogProps) {
  const { t } = useTranslation();

  const total =
    (conflicts?.tileOverlaps.length ?? 0) +
    (conflicts?.icaoConflicts.length ?? 0) +
    (conflicts?.missingLibraries.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('addonManager.conflicts.title')}</DialogTitle>
          <DialogDescription>{t('addonManager.conflicts.description')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <p className="text-sm text-muted-foreground">{t('addonManager.conflicts.none')}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-3">
            <div className="flex flex-col gap-5">
              {conflicts && conflicts.missingLibraries.length > 0 && (
                <Section
                  icon={<Package className="h-4 w-4 text-destructive" />}
                  title={t('addonManager.conflicts.librariesTitle')}
                  description={t('addonManager.conflicts.librariesDescription')}
                >
                  {conflicts.missingLibraries.map((library) => (
                    <div
                      key={library.library}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{library.library}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t('addonManager.conflicts.requiredBy', {
                            count: library.requiredBy.length,
                            name: packName(library.requiredBy[0] ?? ''),
                          })}
                        </p>
                      </div>
                      {library.downloadUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => window.appAPI.openExternal(library.downloadUrl!)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t('addonManager.conflicts.download')}
                        </Button>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {conflicts && conflicts.icaoConflicts.length > 0 && (
                <Section
                  icon={<MapPin className="h-4 w-4 text-warning" />}
                  title={t('addonManager.conflicts.icaoTitle')}
                  description={t('addonManager.conflicts.icaoDescription')}
                >
                  {conflicts.icaoConflicts.map((conflict) => (
                    <div
                      key={conflict.icao}
                      className="rounded-lg border border-border bg-card/50 p-2.5"
                    >
                      <p className="font-mono text-sm">{conflict.icao}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {conflict.entries.map(packName).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-primary">
                        {t('addonManager.conflicts.icaoWinner', {
                          name: packName(conflict.entries[0] ?? ''),
                        })}
                      </p>
                    </div>
                  ))}
                </Section>
              )}

              {conflicts && conflicts.tileOverlaps.length > 0 && (
                <Section
                  icon={<Layers className="h-4 w-4 text-warning" />}
                  title={t('addonManager.conflicts.tilesTitle')}
                  description={t('addonManager.conflicts.tilesDescription')}
                >
                  {conflicts.tileOverlaps.map((overlap) => (
                    <div
                      key={`${overlap.kind}:${overlap.entries[0]}:${overlap.entries[1]}`}
                      className="rounded-lg border border-border bg-card/50 p-2.5"
                    >
                      <p className="truncate text-sm">
                        {packName(overlap.entries[0])} · {packName(overlap.entries[1])}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(
                          overlap.kind === 'overlay'
                            ? 'addonManager.conflicts.kindOverlay'
                            : 'addonManager.conflicts.kindMesh'
                        )}
                        {' · '}
                        {t('addonManager.conflicts.tileOverlap', { count: overlap.tileCount })}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground/70">
                        {overlap.tiles.join(' ')}
                      </p>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
